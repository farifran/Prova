
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/habits.ts
 * @description Motor de Renderização de Cartões de Hábito (Virtual DOM-lite).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia a lista principal de hábitos. É o componente mais pesado da UI.
 * 
 * ARQUITETURA (DOM Caching & Object Pooling):
 * - **Responsabilidade Única:** Criar, atualizar e organizar os cartões de hábito no DOM.
 * - **WeakMap Cache:** Utiliza `WeakMap` para associar metadados (referências a nós filhos) 
 *   aos elementos DOM sem impedir o Garbage Collection quando o nó é removido.
 * - **Template Cloning:** Criação de novos cartões via clonagem de templates para evitar overhead de parsing HTML.
 * - **Object Pooling:** Reutiliza arrays de agrupamento (`habitsByTimePool`) para evitar alocação de memória a cada frame (GC Pause).
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `state.ts`: Dados brutos.
 * - `selectors.ts`: Lógica derivada (streaks, metas).
 * - `dom.ts`: Utilitários de escrita segura.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Separação Criação/Atualização:** `createHabitCardElement` monta o esqueleto; `updateHabitCardElement` hidrata os dados.
 *    Isso permite reciclar esqueletos no futuro se necessário.
 * 2. **Interação com Drag & Drop:** Expõe iteradores (`getLiveHabitCards`) para que o motor de física (`listeners/drag.ts`)
 *    possa ler posições sem varrer o DOM.
 */

// FIX: Import getSmartGoalForHabit from selectors module, not state module.
import { state, Habit, HabitStatus, HabitDayData, STREAK_CONSOLIDATED, STREAK_SEMI_CONSOLIDATED, TimeOfDay, getHabitDailyInfoForDate, TIMES_OF_DAY, HabitDailyInfo } from '../state';
import { calculateHabitStreak, getActiveHabitsForDate, getSmartGoalForHabit } from '../services/selectors';
import { ui } from './ui';
import { t, getHabitDisplayInfo, getTimeOfDayName } from '../i18n';
import { UI_ICONS, getTimeOfDayIcon } from './icons';
import { setTextContent } from './dom';
import { CSS_CLASSES, DOM_SELECTORS } from './constants'; // TYPE SAFETY IMPORT
import { parseUTCIsoDate } from '../utils';

// OTIMIZAÇÃO [2025-01-24]: Cache persistente para cartões de hábitos.
// Mapeia "HabitID|TimeOfDay" -> HTMLElement. Evita recriar DOM se o hábito não mudou de grupo.
const habitElementCache = new Map<string, HTMLElement>();

// PERFORMANCE [2025-03-05]: Cache para referências de elementos internos dos cartões.
// Using WeakMap allows keys (HTML Elements) to be garbage collected automatically when removed from DOM.
// Evita chamar `card.querySelector(...)` repetidamente dentro de `updateHabitCardElement` (Hot Path).
type CardElements = {
    icon: HTMLElement;
    contentWrapper: HTMLElement;
    name: HTMLElement;
    subtitle: HTMLElement;
    details: HTMLElement;
    noteBtn: HTMLElement;
    deleteBtn: HTMLElement; // Added cached reference for delete button
    goal: HTMLElement;
};
const cardElementsCache = new WeakMap<HTMLElement, CardElements>();

// MEMORY OPTIMIZATION [2025-03-04]: Object Pool para agrupamento de hábitos.
// Evita a criação de novos arrays (alocação de memória) a cada frame de renderização.
// Apenas limpamos (.length = 0) e reutilizamos os arrays existentes.
const habitsByTimePool: Record<TimeOfDay, Habit[]> = { 'Morning': [], 'Afternoon': [], 'Evening': [] };

// --- DOM TEMPLATES (PERFORMANCE) ---
// Pre-parsing HTML strings into DOM nodes prevents browser parser overhead during list rendering.

let goalControlsTemplate: HTMLElement | null = null;
let completedWrapperTemplate: HTMLElement | null = null;
let snoozedWrapperTemplate: HTMLElement | null = null;

function getGoalControlsTemplate(): HTMLElement {
    if (!goalControlsTemplate) {
        const div = document.createElement('div');
        div.className = CSS_CLASSES.HABIT_GOAL_CONTROLS;
        div.innerHTML = `
            <button type="button" class="${CSS_CLASSES.GOAL_CONTROL_BTN}" data-action="decrement">-</button>
            <div class="${CSS_CLASSES.GOAL_VALUE_WRAPPER}">
                <div class="progress"></div>
                <div class="unit"></div>
            </div>
            <button type="button" class="${CSS_CLASSES.GOAL_CONTROL_BTN}" data-action="increment">+</button>
        `;
        goalControlsTemplate = div;
    }
    return goalControlsTemplate;
}

function getCompletedWrapperTemplate(): HTMLElement {
    if (!completedWrapperTemplate) {
        const wrapper = document.createElement('div');
        wrapper.className = 'completed-wrapper';
        wrapper.innerHTML = UI_ICONS.check;
        completedWrapperTemplate = wrapper;
    }
    return completedWrapperTemplate;
}

function getSnoozedWrapperTemplate(): HTMLElement {
    if (!snoozedWrapperTemplate) {
        const wrapper = document.createElement('div');
        wrapper.className = 'snoozed-wrapper';
        wrapper.innerHTML = UI_ICONS.snoozed;
        snoozedWrapperTemplate = wrapper;
    }
    return snoozedWrapperTemplate;
}

export function clearHabitDomCache() {
    habitElementCache.clear();
    // cardElementsCache is a WeakMap, it clears itself when elements are GC'd
}

export function getCachedHabitCard(habitId: string, time: TimeOfDay): HTMLElement | undefined {
    return habitElementCache.get(`${habitId}|${time}`);
}

/**
 * ADVANCED OPTIMIZATION [2025-03-17]: Expose live cache iterator.
 * Returns an iterator for all live habit card elements currently in the DOM/Cache.
 * Used by drag handler to avoid `querySelectorAll` layout thrashing.
 */
export function getLiveHabitCards(): IterableIterator<HTMLElement> {
    return habitElementCache.values();
}

export const getUnitString = (habit: Habit, value: number | undefined) => {
    const unitKey = habit.goal.unitKey || 'unitCheck';
    return t(unitKey, { count: value });
};

function _renderCompletedGoal(goalEl: HTMLElement) {
    // OPTIMIZATION: Check classList first to avoid DOM read/write
    if (goalEl.firstElementChild?.classList.contains('completed-wrapper')) return;

    // PERFORMANCE: Template Cloning é mais rápido que innerHTML para estruturas repetitivas.
    goalEl.replaceChildren(getCompletedWrapperTemplate().cloneNode(true));
}

function _renderSnoozedGoal(goalEl: HTMLElement) {
    // PERFORMANCE: Dirty Check antes de manipular o DOM.
    if (goalEl.firstElementChild?.classList.contains('snoozed-wrapper')) return;

    goalEl.replaceChildren(getSnoozedWrapperTemplate().cloneNode(true));
}

function _renderPendingGoalControls(goalEl: HTMLElement, habit: Habit, time: TimeOfDay, dayDataForInstance: HabitDayData | undefined) {
    const hasNumericGoal = habit.goal.type === 'pages' || habit.goal.type === 'minutes';

    if (hasNumericGoal) {
        const smartGoal = getSmartGoalForHabit(habit, state.selectedDate, time);
        const currentGoal = dayDataForInstance?.goalOverride ?? smartGoal;
        const displayVal = currentGoal.toString();
        const unitVal = getUnitString(habit, currentGoal);

        let controls = goalEl.querySelector(`.${CSS_CLASSES.HABIT_GOAL_CONTROLS}`);
        
        if (!controls) {
            goalEl.replaceChildren();
            // PERFORMANCE: Use cloned template instead of creating elements from scratch
            controls = getGoalControlsTemplate().cloneNode(true) as HTMLElement;
            goalEl.appendChild(controls);
        }

        // Locate children in the (potentially cloned) structure
        const decBtn = controls.querySelector(`[data-action="decrement"]`) as HTMLButtonElement;
        const incBtn = controls.querySelector(`[data-action="increment"]`) as HTMLButtonElement;
        const prog = controls.querySelector('.progress');
        const unit = controls.querySelector('.unit');

        // Update Dynamic Data
        // PERFORMANCE: Atribuição direta de propriedades é mais rápida que setAttribute quando possível.
        decBtn.dataset.habitId = habit.id;
        decBtn.dataset.time = time;
        decBtn.setAttribute('aria-label', t('habitGoalDecrement_ariaLabel'));
        decBtn.disabled = currentGoal <= 1;

        incBtn.dataset.habitId = habit.id;
        incBtn.dataset.time = time;
        incBtn.setAttribute('aria-label', t('habitGoalIncrement_ariaLabel'));

        // PERFORMANCE: setTextContent usa nodeValue para evitar reflows.
        setTextContent(prog, displayVal);
        setTextContent(unit, unitVal);
    } else {
        if (goalEl.hasChildNodes()) goalEl.replaceChildren();
    }
}

export function updateGoalContentElement(goalEl: HTMLElement, status: HabitStatus, habit: Habit, time: TimeOfDay, dayDataForInstance: HabitDayData | undefined) {
    // UX UPDATE [2025-03-19]: Simplificação visual no estado 'Completed'.
    // Independentemente do tipo de meta (numérica ou check), se o hábito estiver concluído,
    // exibimos apenas o ícone de checkmark. Isso oculta os controles numéricos para reduzir o ruído visual.
    
    if (status === 'completed') {
        _renderCompletedGoal(goalEl);
    } else if (status === 'snoozed') {
        _renderSnoozedGoal(goalEl);
    } else {
        // Renderiza controles apenas se estiver pendente (e for numérico)
        _renderPendingGoalControls(goalEl, habit, time, dayDataForInstance);
    }
}

export function _updateConsolidationMessage(detailsEl: HTMLElement, streak: number) {
    let msgEl = detailsEl.querySelector<HTMLElement>('.consolidation-message');

    let messageText: string | null = null;
    if (streak >= STREAK_CONSOLIDATED) {
        messageText = t('habitConsolidatedMessage');
    } else if (streak >= STREAK_SEMI_CONSOLIDATED) {
        messageText = t('habitSemiConsolidatedMessage');
    }

    if (messageText) {
        if (!msgEl) {
            msgEl = document.createElement('div');
            msgEl.className = 'consolidation-message';
            detailsEl.appendChild(msgEl);
        }
        setTextContent(msgEl, messageText);
    } else if (msgEl) {
        msgEl.remove();
    }
}

/**
 * Updates a habit card's DOM with current state.
 * PERFORMANCE [2025-03-16]: Accepts optional `preLoadedDailyInfo` to avoid fetching data map repeatedly in loops.
 * [HOT PATH]: Esta função é chamada N vezes por frame de renderização.
 */
export function updateHabitCardElement(
    card: HTMLElement, 
    habit: Habit, 
    time: TimeOfDay, 
    preLoadedDailyInfo?: Record<string, HabitDailyInfo>
): void {
    let elements = cardElementsCache.get(card);
    
    // FIX [2025-03-09]: ROBUSTNESS AUTO-REPAIR.
    // Se o cache foi limpo (ex: memória baixa) mas o cartão ainda existe no DOM (ex: dentro de um loop de evento),
    // precisamos re-consultar os elementos para evitar falha silenciosa.
    if (!elements) {
        const icon = card.querySelector('.habit-icon') as HTMLElement;
        const contentWrapper = card.querySelector(`.${CSS_CLASSES.HABIT_CONTENT_WRAPPER}`) as HTMLElement;
        
        // If critical elements are missing from DOM, we can't repair. Abort.
        if (icon && contentWrapper) {
             elements = {
                icon: icon,
                contentWrapper: contentWrapper,
                name: card.querySelector('.name') as HTMLElement,
                subtitle: card.querySelector('.subtitle') as HTMLElement,
                details: card.querySelector(`.${CSS_CLASSES.HABIT_DETAILS}`) as HTMLElement,
                noteBtn: card.querySelector(`.${CSS_CLASSES.SWIPE_NOTE_BTN}`) as HTMLElement,
                deleteBtn: card.querySelector(`.${CSS_CLASSES.SWIPE_DELETE_BTN}`) as HTMLElement,
                goal: card.querySelector('.habit-goal') as HTMLElement,
            };
            // Repair cache
            cardElementsCache.set(card, elements);
        } else {
            console.warn(`Critical DOM elements missing for habit ${habit.id}. Cannot render.`);
            return;
        }
    }
    
    const { icon, contentWrapper, name: nameEl, subtitle: subtitleEl, details: detailsEl, noteBtn, deleteBtn, goal: goalEl } = elements;
    
    // OPTIMIZATION: Use injected daily info map if available, otherwise fetch it.
    // Evita chamadas repetitivas a `getHabitDailyInfoForDate` que podem envolver JSON parsing (Cold Storage).
    const dailyInfo = preLoadedDailyInfo || getHabitDailyInfoForDate(state.selectedDate);
    
    const habitInstanceData = dailyInfo[habit.id]?.instances?.[time];
    const status = habitInstanceData?.status ?? CSS_CLASSES.PENDING;
    const hasNote = habitInstanceData?.note && habitInstanceData.note.length > 0;
    const streak = calculateHabitStreak(habit.id, state.selectedDate);
    const { name, subtitle } = getHabitDisplayInfo(habit, state.selectedDate);

    const wasCompleted = card.classList.contains(CSS_CLASSES.COMPLETED);
    // PERFORMANCE: Dirty Check de Classes CSS.
    if (!card.classList.contains(status)) {
        card.classList.remove(CSS_CLASSES.PENDING, CSS_CLASSES.COMPLETED, CSS_CLASSES.SNOOZED);
        card.classList.add(status);
    }

    const isCompleted = status === CSS_CLASSES.COMPLETED;
    
    const newIconHtml = habit.icon;
    const newColor = habit.color;
    const newBgColor = `${habit.color}30`;

    // PERFORMANCE: Cache local de HTML no objeto para evitar re-parse se o ícone não mudou.
    if ((icon as any)._cachedIconHtml !== newIconHtml) {
        icon.innerHTML = newIconHtml;
        (icon as any)._cachedIconHtml = newIconHtml;
    }
    
    // OPTIMIZATION [2025-03-09]: Dirty Check styles to prevent Layout Thrashing
    if (icon.style.color !== newColor) icon.style.color = newColor;
    if (icon.style.backgroundColor !== newBgColor) icon.style.backgroundColor = newBgColor;

    if (!wasCompleted && isCompleted) {
        icon.classList.remove('animate-pop');
        void icon.offsetWidth; // Trigger Reflow para reiniciar animação
        icon.classList.add('animate-pop');
        icon.addEventListener('animationend', () => icon.classList.remove('animate-pop'), { once: true });
    }

    const isConsolidated = streak >= STREAK_CONSOLIDATED;
    const isSemi = streak >= STREAK_SEMI_CONSOLIDATED && !isConsolidated;
    
    // PERFORMANCE: Toggle condicional.
    if (card.classList.contains('consolidated') !== isConsolidated) {
        card.classList.toggle('consolidated', isConsolidated);
    }
    if (card.classList.contains('semi-consolidated') !== isSemi) {
        card.classList.toggle('semi-consolidated', isSemi);
    }
    
    const newLabel = `${name}, ${t(`filter${time}`)}, ${status}`;
    if (contentWrapper.getAttribute('aria-label') !== newLabel) {
        contentWrapper.setAttribute('aria-label', newLabel);
    }
    
    setTextContent(nameEl, name);
    setTextContent(subtitleEl, subtitle);

    _updateConsolidationMessage(detailsEl, streak);
    
    const hasNoteStr = String(hasNote);
    if (noteBtn.dataset.hasNote !== hasNoteStr) {
        noteBtn.innerHTML = hasNote ? UI_ICONS.swipeNoteHasNote : UI_ICONS.swipeNote;
        noteBtn.setAttribute('aria-label', t(hasNote ? 'habitNoteEdit_ariaLabel' : 'habitNoteAdd_ariaLabel'));
        noteBtn.dataset.hasNote = hasNoteStr;
    }

    // A11Y FIX [2025-03-08]: Update aria-label for delete button dynamically on language change
    deleteBtn.setAttribute('aria-label', t('habitEnd_ariaLabel'));

    updateGoalContentElement(goalEl, status, habit, time, habitInstanceData);
}

export function createHabitCardElement(habit: Habit, time: TimeOfDay, preLoadedDailyInfo?: Record<string, HabitDailyInfo>): HTMLElement {
    // REFACTOR [2025-03-05]: Pure Skeleton Factory.
    // Removes redundant logic by building only the DOM structure and delegating
    // all data population (status, text, classes) to updateHabitCardElement.
    
    const card = document.createElement('li');
    card.className = CSS_CLASSES.HABIT_CARD; 
    card.dataset.habitId = habit.id;
    card.dataset.time = time;

    const actionsLeft = document.createElement('div');
    actionsLeft.className = 'habit-actions-left';
    // NOTE: aria-label set initially but updated dynamically in updateHabitCardElement
    actionsLeft.innerHTML = `<button type="button" class="${CSS_CLASSES.SWIPE_DELETE_BTN}">${UI_ICONS.swipeDelete}</button>`;

    const actionsRight = document.createElement('div');
    actionsRight.className = 'habit-actions-right';
    actionsRight.innerHTML = `<button type="button" class="${CSS_CLASSES.SWIPE_NOTE_BTN}">${UI_ICONS.swipeNote}</button>`;
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = CSS_CLASSES.HABIT_CONTENT_WRAPPER;
    contentWrapper.draggable = true;
    
    contentWrapper.setAttribute('role', 'button');
    contentWrapper.setAttribute('tabindex', '0');

    const icon = document.createElement('div');
    icon.className = 'habit-icon';

    const details = document.createElement('div');
    details.className = CSS_CLASSES.HABIT_DETAILS;
    
    const nameEl = document.createElement('div');
    nameEl.className = 'name';
    const subtitleEl = document.createElement('div');
    subtitleEl.className = 'subtitle';
    
    details.append(nameEl, subtitleEl);

    const goal = document.createElement('div');
    goal.className = 'habit-goal';

    contentWrapper.append(icon, details, goal);
    card.append(actionsLeft, actionsRight, contentWrapper);
    
    // Cache the root element
    habitElementCache.set(`${habit.id}|${time}`, card);

    // PERFORMANCE [2025-03-05]: Cache internal element references ONCE at creation using WeakMap.
    // This makes subsequent updates O(1) by avoiding querySelector.
    cardElementsCache.set(card, {
        icon: icon,
        contentWrapper: contentWrapper,
        name: nameEl,
        subtitle: subtitleEl,
        details: details,
        noteBtn: actionsRight.querySelector(`.${CSS_CLASSES.SWIPE_NOTE_BTN}`)!,
        deleteBtn: actionsLeft.querySelector(`.${CSS_CLASSES.SWIPE_DELETE_BTN}`)!,
        goal: goal,
    });

    // DELEGATION: Populate data immediately using cached elements.
    updateHabitCardElement(card, habit, time, preLoadedDailyInfo);

    return card;
}

export function updatePlaceholderForGroup(groupEl: HTMLElement, time: TimeOfDay, hasHabits: boolean, isSmartPlaceholder: boolean, emptyTimes: TimeOfDay[]) {
    let placeholder = groupEl.querySelector<HTMLElement>(DOM_SELECTORS.EMPTY_GROUP_PLACEHOLDER);
    
    if (!hasHabits) {
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = CSS_CLASSES.EMPTY_GROUP_PLACEHOLDER;
            placeholder.setAttribute('role', 'button');
            placeholder.setAttribute('tabindex', '0');
            groupEl.appendChild(placeholder);
        }
        // Dirty Check
        if (placeholder.classList.contains('show-smart-placeholder') !== isSmartPlaceholder) {
            placeholder.classList.toggle('show-smart-placeholder', isSmartPlaceholder);
        }
        
        const text = t('dragToAddHabit');
        let iconHTML = '';

        if (isSmartPlaceholder) {
            const genericIconHTML = emptyTimes
                .map(getTimeOfDayIcon)
                .join('<span class="icon-separator">/</span>');
            const specificIconHTML = getTimeOfDayIcon(time);
            
            iconHTML = `
                <span class="placeholder-icon-generic">${genericIconHTML}</span>
                <span class="placeholder-icon-specific">${specificIconHTML}</span>
            `;
        } else {
            iconHTML = `<span class="placeholder-icon-specific">${getTimeOfDayIcon(time)}</span>`;
        }
        
        // PERFORMANCE: Verifica se o conteúdo HTML mudou antes de atribuir para evitar parsing.
        const newInner = `<div class="time-of-day-icon">${iconHTML}</span><span>${text}</span>`;
        if (placeholder.innerHTML !== newInner) {
            placeholder.innerHTML = newInner;
        }

    } else if (placeholder) {
        placeholder.remove();
    }
}

/**
 * Função Principal de Renderização da Lista.
 * Reconstrói a árvore de hábitos se necessário, reutilizando nós do cache.
 */
export function renderHabits() {
    // PERFORMANCE: Dirty Check global. Se a estrutura da lista não mudou, aborta.
    if (!state.uiDirtyState.habitListStructure) {
        return;
    }

    // OTIMIZAÇÃO [2025-03-16]: Pre-Parse Date & Batch Fetch Data.
    // We parse the date ONCE and fetch the daily data ONCE for the entire render cycle.
    // This avoids redundant parsing and cache lookups inside loops (N habits * M invocations).
    const selectedDateObj = parseUTCIsoDate(state.selectedDate);
    const dailyInfo = getHabitDailyInfoForDate(state.selectedDate);
    
    // Pass pre-parsed date to selector to avoid re-parsing inside filter loop
    const activeHabitsData = getActiveHabitsForDate(state.selectedDate, selectedDateObj);
    
    // MEMORY OPTIMIZATION: Reset pool instead of creating new objects.
    habitsByTimePool.Morning.length = 0;
    habitsByTimePool.Afternoon.length = 0;
    habitsByTimePool.Evening.length = 0;
    
    activeHabitsData.forEach(({ habit, schedule }) => {
        schedule.forEach(time => {
            if (habitsByTimePool[time]) {
                habitsByTimePool[time].push(habit);
            }
        });
    });

    // OTIMIZAÇÃO: Filtra diretamente para obter os horários vazios em uma única passagem.
    const emptyTimes = TIMES_OF_DAY.filter(time => habitsByTimePool[time].length === 0);
    const smartPlaceholderTargetTime: TimeOfDay | undefined = emptyTimes[0];

    TIMES_OF_DAY.forEach(time => {
        const wrapperEl = ui.habitContainer.querySelector(`.habit-group-wrapper[data-time-wrapper="${time}"]`);
        if (!wrapperEl) return;
        
        const groupEl = wrapperEl.querySelector<HTMLElement>(`.${CSS_CLASSES.HABIT_GROUP}[data-time="${time}"]`);
        const marker = wrapperEl.querySelector<HTMLElement>('.time-marker');
        if (!groupEl || !marker) return;
        
        const desiredHabits = habitsByTimePool[time];
        const hasHabits = desiredHabits.length > 0;

        // Toggle Marker Visibility
        if (hasHabits) {
            const iconHtml = getTimeOfDayIcon(time);
            if (marker.innerHTML !== iconHtml) marker.innerHTML = iconHtml;
            if (marker.style.display !== '') marker.style.display = '';
            if (marker.style.opacity !== '1') marker.style.opacity = '1';
        } else {
            if (marker.style.display !== 'none') marker.style.display = 'none'; 
            if (marker.innerHTML !== '') marker.innerHTML = ''; 
        }

        const ariaLabel = getTimeOfDayName(time);
        if (groupEl.getAttribute('aria-label') !== ariaLabel) {
            groupEl.setAttribute('aria-label', ariaLabel);
        }

        let currentIndex = 0;

        // Reconciliação do DOM (Virtual DOM-lite)
        desiredHabits.forEach(habit => {
            const key = `${habit.id}|${time}`;
            
            let card = habitElementCache.get(key);
            
            if (card) {
                // Reset states
                card.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT, CSS_CLASSES.IS_SWIPING, CSS_CLASSES.DRAGGING);
                // Pass pre-fetched dailyInfo to avoid re-fetch
                updateHabitCardElement(card, habit, time, dailyInfo);
            } else {
                // UPDATE [2025-03-16]: Pass pre-fetched dailyInfo to card creation logic
                card = createHabitCardElement(habit, time, dailyInfo);
            }
            
            if (card) {
                const currentChildAtIndex = groupEl.children[currentIndex];
                // Move o nó apenas se estiver na posição errada
                if (currentChildAtIndex !== card) {
                    if (currentChildAtIndex) {
                        groupEl.insertBefore(card, currentChildAtIndex);
                    } else {
                        groupEl.appendChild(card);
                    }
                }
                currentIndex++;
            }
        });

        // MEMORY LEAK FIX [2025-03-05]: Limpa os caches para elementos removidos do DOM.
        // Remove quaisquer filhos extras que não deveriam estar lá.
        while (groupEl.children.length > currentIndex) {
            const childToRemove = groupEl.lastChild as HTMLElement;
            if (childToRemove) {
                const habitId = childToRemove.dataset.habitId;
                const habitTime = childToRemove.dataset.time as TimeOfDay;

                if (habitId && habitTime) {
                    const cacheKey = `${habitId}|${habitTime}`;
                    
                    // FIX [2025-03-09]: Only remove from cache if the cached element is the one being removed.
                    // This prevents deleting the cache entry for a new card that has just been created
                    // (and has the same key) but is inserted before this cleanup runs.
                    if (habitElementCache.get(cacheKey) === childToRemove) {
                        habitElementCache.delete(cacheKey);
                    }
                    // WeakMap clears automatically
                }
                childToRemove.remove();
            }
        }
        
        const isSmartPlaceholder = time === smartPlaceholderTargetTime;
        
        // Batch Class Updates on Wrapper
        if (wrapperEl.classList.contains('has-habits') !== hasHabits) wrapperEl.classList.toggle('has-habits', hasHabits);
        
        const isCollapsible = !hasHabits && !isSmartPlaceholder;
        if (wrapperEl.classList.contains('is-collapsible') !== isCollapsible) wrapperEl.classList.toggle('is-collapsible', isCollapsible);

        updatePlaceholderForGroup(groupEl, time, hasHabits, isSmartPlaceholder, emptyTimes);
    });

    state.uiDirtyState.habitListStructure = false;
}
