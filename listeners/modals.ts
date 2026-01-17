
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/modals.ts
 * @description Controlador de Interação de Modais (Forms, Configurações, Diálogos).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia o ciclo de vida de interações complexas que pausam o fluxo principal da aplicação.
 * 
 * ARQUITETURA (Mediator Pattern):
 * - Atua como a "cola" entre os eventos de DOM (Clicks, Inputs) e a Lógica de Negócios (`habitActions.ts`).
 * - Não contém lógica de estado profunda; delega para Actions e solicita re-renderização.
 * 
 * DECISÕES TÉCNICAS:
 * 1. Event Delegation: A lista de "Gerenciar Hábitos" usa um único listener no pai (`ui.habitList`)
 *    para gerenciar cliques em N botões de ação, economizando memória e custos de attach/detach.
 * 2. Estado Efêmero: Usa `state.editingHabit` como um "Rascunho" (Draft) durante a edição,
 *    commitando alterações apenas no "Salvar".
 * 3. Feedback Visual (RAF): Usa `requestAnimationFrame` para garantir que animações CSS (como Shake)
 *    sejam disparadas no momento correto do pipeline de renderização.
 */

import { ui } from '../render/ui';
import { 
    state, 
    LANGUAGES, 
    STREAK_SEMI_CONSOLIDATED, 
    STREAK_CONSOLIDATED, 
    DAYS_IN_CALENDAR, 
    invalidateChartCache, 
    FREQUENCIES
} from '../state';
// ARCHITECTURE FIX: Import persistence logic from service layer.
import { saveState } from '../services/persistence';
// ARCHITECTURE FIX: Import predefined habits from data layer, not state module.
import { PREDEFINED_HABITS } from '../data/predefinedHabits';
import {
    openModal,
    closeModal,
    setupManageModal,
    renderExploreHabits,
    showConfirmationModal,
    renderLanguageFilter,
    renderAINotificationState,
    openEditModal,
    updateNotificationUI,
    renderFrequencyOptions,
    renderIconPicker,
    renderColorPicker,
    renderFullCalendar,
    renderApp,
} from '../render';
import {
    saveHabitFromModal,
    requestHabitEndingFromModal,
    requestHabitPermanentDeletion,
    requestHabitEditingFromModal,
    resetApplicationData,
    handleSaveNote,
    graduateHabit,
    performAIAnalysis,
    exportData,
    importData,
} from '../habitActions';
import { t, getHabitDisplayInfo, setLanguage } from '../i18n';
import { setupReelRotary } from '../render/rotary';
import { simpleMarkdownToHTML, pushToOneSignal, getContrastColor, addDays, parseUTCIsoDate, toUTCIsoDateString } from '../utils';
import { setTextContent } from '../render/dom';
import { isHabitNameDuplicate } from '../services/selectors';
// PERFORMANCE: Import preloadWorker for early initialization
import { preloadWorker } from '../services/cloud';

// REFACTOR [2024-09-02]: Centraliza a lógica de processamento e formatação de celebrações
const _processAndFormatCelebrations = (
    pendingIds: string[], 
    translationKey: 'aiCelebration21Day' | 'aiCelebration66Day',
    streakMilestone: number
): string => {
    if (pendingIds.length === 0) return '';
    
    // PERFORMANCE: Mapeamento e filtragem em cadeia para preparar string de notificação.
    const habitNames = pendingIds
        .map(id => state.habits.find(h => h.id === id))
        .filter(Boolean)
        .map(h => getHabitDisplayInfo(h!).name)
        .join(', ');
        
    pendingIds.forEach(id => {
        const celebrationId = `${id}-${streakMilestone}`;
        if (!state.notificationsShown.includes(celebrationId)) {
            state.notificationsShown.push(celebrationId);
        }
    });

    return t(translationKey, { count: pendingIds.length, habitNames });
};

// --- PRIVATE HELPERS (MODAL FORMS) ---

function _handleFrequencyTypeChange(radio: HTMLInputElement) {
    if (!state.editingHabit) return;

    // Lógica de formulário complexa: Alterna entre estruturas de dados diferentes para frequência
    const type = radio.value as 'daily' | 'interval' | 'specific_days_of_week';
    switch (type) {
        case 'daily':
            state.editingHabit.formData.frequency = { type: 'daily' };
            break;
        case 'specific_days_of_week':
            const currentFreq = state.editingHabit.formData.frequency;
            const days = currentFreq.type === 'specific_days_of_week' ? currentFreq.days : [];
            state.editingHabit.formData.frequency = { type: 'specific_days_of_week', days };
            break;
        case 'interval':
            const intervalFreqTpl = FREQUENCIES.find(f => f.value.type === 'interval')!.value as { type: 'interval', unit: 'days' | 'weeks', amount: number };
            const currentIntervalFreq = state.editingHabit.formData.frequency;
            // Preserva valores anteriores se já estava no modo intervalo
            const amount = (currentIntervalFreq.type === 'interval' ? currentIntervalFreq.amount : intervalFreqTpl.amount);
            const unit = (currentIntervalFreq.type === 'interval' ? currentIntervalFreq.unit : intervalFreqTpl.unit);
            state.editingHabit.formData.frequency = { type: 'interval', amount, unit };
            break;
    }
    renderFrequencyOptions();
}

function _handleWeekdaySelectionChange() {
    if (!state.editingHabit) return;

    const days = Array.from(ui.frequencyOptionsContainer.querySelectorAll<HTMLInputElement>('.weekday-picker input:checked'))
        .map(el => parseInt(el.dataset.day!, 10));
    state.editingHabit.formData.frequency = { type: 'specific_days_of_week', days };
}

function _handleIntervalControlChange(button: HTMLButtonElement) {
    if (!state.editingHabit || state.editingHabit.formData.frequency.type !== 'interval') return;

    const action = button.dataset.action;
    const currentFreq = state.editingHabit.formData.frequency;
    let { amount, unit } = currentFreq;

    if (action === 'interval-decrement') amount = Math.max(1, amount - 1);
    if (action === 'interval-increment') amount = Math.min(99, amount + 1);
    if (action === 'interval-unit-toggle') unit = unit === 'days' ? 'weeks' : 'days';

    state.editingHabit.formData.frequency = { type: 'interval', amount, unit };
    renderFrequencyOptions();
}

/**
 * Validação de formulário com feedback visual (Shake Animation).
 * @returns true se válido, false caso contrário.
 */
function _validateHabitName(newName: string, currentHabitId?: string): boolean {
    const formNoticeEl = ui.editHabitForm.querySelector<HTMLElement>('.form-notice')!;
    const habitNameInput = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;

    formNoticeEl.classList.remove('visible');
    habitNameInput.classList.remove('shake');
    
    const trimmedName = newName.trim();

    if (trimmedName.length === 0) {
        formNoticeEl.textContent = t('noticeNameCannotBeEmpty');
        formNoticeEl.classList.add('visible');
        
        // UX: Animação de erro.
        // requestAnimationFrame garante que a remoção da classe 'shake' anterior foi processada
        // antes de readicioná-la, permitindo que a animação reinicie.
        requestAnimationFrame(() => {
            habitNameInput.classList.add('shake');
            habitNameInput.addEventListener('animationend', () => {
                habitNameInput.classList.remove('shake');
            }, { once: true });
        });
        
        return false;
    }

    if (trimmedName.length > 16) {
        formNoticeEl.textContent = t('noticeNameTooLong');
        formNoticeEl.classList.add('visible');
        
        requestAnimationFrame(() => {
            habitNameInput.classList.add('shake');
            habitNameInput.addEventListener('animationend', () => {
                habitNameInput.classList.remove('shake');
            }, { once: true });
        });
        
        return false;
    }
    
    if (isHabitNameDuplicate(trimmedName, currentHabitId)) {
        formNoticeEl.textContent = t('noticeDuplicateHabitWithName');
        formNoticeEl.classList.add('visible');
        
        requestAnimationFrame(() => {
            habitNameInput.classList.add('shake');
            habitNameInput.addEventListener('animationend', () => {
                habitNameInput.classList.remove('shake');
            }, { once: true });
        });
        
        return false;
    }

    return true;
}


export function setupModalListeners() {
    // --- MAIN DASHBOARD ACTIONS ---
    
    ui.manageHabitsBtn.addEventListener('click', () => {
        // Calls the imported setupManageModal from render/modals.ts
        setupManageModal();
        updateNotificationUI();
        openModal(ui.manageModal);
    });

    ui.fabAddHabit.addEventListener('click', () => {
        renderExploreHabits();
        openModal(ui.exploreModal);
    });
    
    // PERFORMANCE: Event Delegation for Manage Habit List.
    // Em vez de adicionar listeners em cada botão de cada linha (o que seria caro para listas longas),
    // escutamos no container pai e identificamos a ação via classes CSS.
    ui.habitList.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>('button');
        if (!button) return;

        const habitId = button.closest<HTMLLIElement>('li.habit-list-item')?.dataset.habitId;
        if (!habitId) return;

        // Roteamento de ações baseado em classes
        if (button.classList.contains('end-habit-btn')) {
            requestHabitEndingFromModal(habitId);
        } else if (button.classList.contains('permanent-delete-habit-btn')) {
            requestHabitPermanentDeletion(habitId);
        } else if (button.classList.contains('edit-habit-btn')) {
            requestHabitEditingFromModal(habitId);
        } else if (button.classList.contains('graduate-habit-btn')) {
            graduateHabit(habitId);
        }
    });

    ui.manageModal.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.id === 'export-data-btn') {
            exportData();
        } else if (target.id === 'import-data-btn') {
            importData();
        }
    });

    ui.resetAppBtn.addEventListener('click', () => {
        showConfirmationModal(
            t('confirmResetApp'),
            resetApplicationData,
            { 
                confirmText: t('modalManageResetButton'), 
                title: t('modalManageReset'),
                confirmButtonStyle: 'danger'
            }
        );
    });
    
    // Configuração do componente Reel Rotary (Seletor de Idioma)
    setupReelRotary({
        viewportEl: ui.languageViewport,
        reelEl: ui.languageReel,
        prevBtn: ui.languagePrevBtn,
        nextBtn: ui.languageNextBtn,
        optionsCount: LANGUAGES.length,
        getInitialIndex: () => LANGUAGES.findIndex(l => l.code === state.activeLanguageCode),
        onIndexChange: async (index) => {
            const newLang = LANGUAGES[index].code;
            if (newLang !== state.activeLanguageCode) {
                await setLanguage(newLang);
            }
        },
        render: renderLanguageFilter,
    });
    
    // --- NOTIFICATIONS & PERMISSIONS ---
    ui.notificationToggle.addEventListener('change', () => {
        // ASYNC OPERATION: Push notification permission request.
        pushToOneSignal(async (OneSignal: any) => {
            const wantsEnabled = ui.notificationToggle.checked;
            
            // Execute the action in the background
            if (wantsEnabled) {
                await OneSignal.Notifications.requestPermission();
            } else {
                await OneSignal.User.PushSubscription.optOut();
            }

            // Update UI immediately to show pending state
            // UX: Desabilita o toggle para evitar estados inconsistentes enquanto a permissão processa
            ui.notificationToggle.disabled = true;
            setTextContent(ui.notificationStatusDesc, t('notificationChangePending'));
        });
    });

    // --- EXPLORE HABITS & PRESETS ---
    ui.exploreHabitList.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.explore-habit-item');
        if (!item) return;
        const index = parseInt(item.dataset.index!, 10);
        const habitTemplate = PREDEFINED_HABITS[index];
        if (habitTemplate) {
            // Verifica se o usuário já tem um hábito com este nome (mesmo que antigo/encerrado)
            const anyExistingHabit = state.habits.find(h =>
                h.scheduleHistory.some(s => s.nameKey === habitTemplate.nameKey)
            );
    
            closeModal(ui.exploreModal);
    
            if (anyExistingHabit) {
                // Se o hábito já existe (ativo, encerrado ou graduado),
                // apenas abra o modal de edição para ele. A lógica de salvamento
                // cuidará da criação de um novo agendamento, "reativando-o" efetivamente.
                openEditModal(anyExistingHabit);
            } else {
                // Se nenhum hábito deste tipo existe, crie um novo a partir do modelo.
                openEditModal(habitTemplate);
            }
        }
    });

    // A11Y: Suporte a teclado na lista de exploração
    ui.exploreHabitList.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            const item = (e.target as HTMLElement).closest<HTMLElement>('.explore-habit-item');
            if (item) {
                item.click();
            }
        }
    });

    ui.createCustomHabitBtn.addEventListener('click', () => {
        closeModal(ui.exploreModal);
        openEditModal(null); // null = Modo de criação limpo
    });

    // --- AI FEATURES ---
    ui.aiEvalBtn.addEventListener('click', () => {
        // PERFORMANCE: Worker Pre-warming.
        // Inicia o worker assim que o usuário abre o menu de IA.
        // Como o usuário vai levar alguns segundos lendo as opções (Mensal, Trimestral),
        // o worker estará pronto e "quente" quando o clique da análise ocorrer.
        preloadWorker();

        // Verifica se há celebrações pendentes (21 ou 66 dias)
        const celebration21DayText = _processAndFormatCelebrations(state.pending21DayHabitIds, 'aiCelebration21Day', STREAK_SEMI_CONSOLIDATED);
        const celebration66DayText = _processAndFormatCelebrations(state.pendingConsolidationHabitIds, 'aiCelebration66Day', STREAK_CONSOLIDATED);
        
        const allCelebrations = [celebration66DayText, celebration21DayText].filter(Boolean).join('\n\n');

        if (allCelebrations) {
            // Prioridade 1: Exibir celebrações
            ui.aiResponse.innerHTML = simpleMarkdownToHTML(allCelebrations);
            openModal(ui.aiModal, undefined, () => {
                state.hasSeenAIResult = true;
                renderAINotificationState();
            });
            // Limpa filas de pendência
            state.pending21DayHabitIds = [];
            state.pendingConsolidationHabitIds = [];
            saveState(); // Salva que as notificações foram vistas
            renderAINotificationState();
        } else if ((state.aiState === 'completed' || state.aiState === 'error') && !state.hasSeenAIResult && state.lastAIResult) {
            // Prioridade 2: Exibir resultado de análise anterior não visto
            ui.aiResponse.innerHTML = simpleMarkdownToHTML(state.lastAIResult);
            openModal(ui.aiModal, undefined, () => {
                state.hasSeenAIResult = true;
                renderAINotificationState();
            });
        } else {
            // Prioridade 3: Menu de opções de IA
            openModal(ui.aiOptionsModal);
        }
    });

    ui.aiOptionsModal.addEventListener('click', e => {
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.ai-option-btn');
        if (!button) return;
        const analysisType = button.dataset.analysisType as 'monthly' | 'quarterly' | 'historical';
        performAIAnalysis(analysisType);
    });

    // --- GENERIC DIALOGS ---
    ui.confirmModalConfirmBtn.addEventListener('click', () => {
        const action = state.confirmAction;
        state.confirmAction = null;
        state.confirmEditAction = null;
        closeModal(ui.confirmModal);
        action?.(); // Executa a ação confirmada
    });
    
    ui.confirmModalEditBtn.addEventListener('click', () => {
        const editAction = state.confirmEditAction;
        state.confirmAction = null;
        state.confirmEditAction = null;
        closeModal(ui.confirmModal);
        editAction?.();
    });

    ui.saveNoteBtn.addEventListener('click', handleSaveNote);

    // --- FULL CALENDAR NAVIGATION ---
    ui.fullCalendarPrevBtn.addEventListener('click', () => {
        state.fullCalendar.month--;
        if (state.fullCalendar.month < 0) {
            state.fullCalendar.month = 11;
            state.fullCalendar.year--;
        }
        renderFullCalendar();
    });

    ui.fullCalendarNextBtn.addEventListener('click', () => {
        state.fullCalendar.month++;
        if (state.fullCalendar.month > 11) {
            state.fullCalendar.month = 0;
            state.fullCalendar.year++;
        }
        renderFullCalendar();
    });

    // Event Delegation para cliques nos dias do calendário completo
    ui.fullCalendarGrid.addEventListener('click', (e) => {
        const dayEl = (e.target as HTMLElement).closest<HTMLElement>('.full-calendar-day');
        if (dayEl && dayEl.dataset.date) {
            state.selectedDate = dayEl.dataset.date;
            
            // Recalcula o array de datas do calendário da barra superior
            const newDate = parseUTCIsoDate(state.selectedDate);
            state.calendarDates = Array.from({ length: DAYS_IN_CALENDAR }, (_, i) => 
                addDays(newDate, i - 30)
            );

            closeModal(ui.fullCalendarModal);
            
            // Marca a UI como suja para re-renderização total
            state.uiDirtyState.calendarVisuals = true;
            state.uiDirtyState.habitListStructure = true;
            invalidateChartCache();
            
            renderApp();

            // UX: Scroll suave para o dia selecionado na barra
            requestAnimationFrame(() => {
                const selectedEl = ui.calendarStrip.querySelector('.day-item.selected');
                selectedEl?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            });
        }
    });

    // A11Y: Navegação por teclado no calendário
    ui.fullCalendarGrid.addEventListener('keydown', (e) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
            return;
        }
        e.preventDefault();
    
        if (e.key === 'Enter' || e.key === ' ') {
            closeModal(ui.fullCalendarModal);
            const newDate = parseUTCIsoDate(state.selectedDate);
            state.calendarDates = Array.from({ length: DAYS_IN_CALENDAR }, (_, i) => 
                addDays(newDate, i - 30)
            );

            state.uiDirtyState.calendarVisuals = true;
            state.uiDirtyState.habitListStructure = true;
            invalidateChartCache();
            
            renderApp();
            
            requestAnimationFrame(() => {
                const selectedEl = ui.calendarStrip.querySelector('.day-item.selected');
                selectedEl?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
            });
            return;
        }
    
        const currentSelectedDate = parseUTCIsoDate(state.selectedDate);
        let newDate: Date;
    
        switch (e.key) {
            case 'ArrowRight': newDate = addDays(currentSelectedDate, 1); break;
            case 'ArrowLeft': newDate = addDays(currentSelectedDate, -1); break;
            case 'ArrowUp': newDate = addDays(currentSelectedDate, -7); break;
            case 'ArrowDown': newDate = addDays(currentSelectedDate, 7); break;
            default: return;
        }
    
        state.selectedDate = toUTCIsoDateString(newDate);
    
        // Se mudou de mês, atualiza a view
        if (newDate.getUTCMonth() !== state.fullCalendar.month || newDate.getUTCFullYear() !== state.fullCalendar.year) {
            state.fullCalendar.month = newDate.getUTCMonth();
            state.fullCalendar.year = newDate.getUTCFullYear();
        }
        
        renderFullCalendar();
        
        // UX: Mantém o foco no elemento do dia recém-selecionado
        requestAnimationFrame(() => {
            const newSelectedEl = ui.fullCalendarGrid.querySelector<HTMLElement>(`.full-calendar-day[data-date="${state.selectedDate}"]`);
            newSelectedEl?.focus();
        });
    });

    // --- HABIT EDITING ---
    ui.editHabitSaveBtn.addEventListener('click', saveHabitFromModal);

    const habitNameInput = ui.editHabitForm.elements.namedItem('habit-name') as HTMLInputElement;
    
    // Validação em tempo real (onInput)
    habitNameInput.addEventListener('input', () => {
        if (!state.editingHabit) return;
        
        const newName = habitNameInput.value;
        state.editingHabit.formData.name = newName;
        // Ao editar manualmente, removemos a chave de tradução para preservar o input do usuário
        delete state.editingHabit.formData.nameKey; 

        const isValid = _validateHabitName(newName, state.editingHabit.habitId);
        ui.editHabitSaveBtn.disabled = !isValid;
    });

    // Seletor de Ícones
    ui.habitIconPickerBtn.addEventListener('click', () => {
        renderIconPicker();
        openModal(ui.iconPickerModal);
    });

    ui.iconPickerGrid.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const item = target.closest<HTMLButtonElement>('.icon-picker-item');
        if (item && state.editingHabit) {
            const iconSVG = item.dataset.iconSvg!;
            state.editingHabit.formData.icon = iconSVG;
            ui.habitIconPickerBtn.innerHTML = iconSVG;
            closeModal(ui.iconPickerModal);
        }
    });
    
    // Seletor de Cores
    ui.colorPickerGrid.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const swatch = target.closest<HTMLButtonElement>('.color-swatch');
        if (swatch && state.editingHabit) {
            const color = swatch.dataset.color!;
            state.editingHabit.formData.color = color;

            const iconColor = getContrastColor(color);
            ui.habitIconPickerBtn.style.backgroundColor = color;
            ui.habitIconPickerBtn.style.color = iconColor;
            
            ui.colorPickerGrid.querySelector('.selected')?.classList.remove('selected');
            swatch.classList.add('selected');

            ui.iconPickerModal.classList.remove('is-picking-color');
            renderIconPicker();
            closeModal(ui.colorPickerModal);
        }
    });

    ui.changeColorFromPickerBtn.addEventListener('click', () => {
        renderColorPicker();
        ui.iconPickerModal.classList.add('is-picking-color');
        openModal(ui.colorPickerModal, undefined, () => {
            ui.iconPickerModal.classList.remove('is-picking-color');
            renderIconPicker();
        });
    });

    // Seletor de Horário (Segmented Control)
    ui.habitTimeContainer.addEventListener('click', e => {
        if (!state.editingHabit) return;
        const button = (e.target as HTMLElement).closest<HTMLButtonElement>('.segmented-control-option');
        if (!button) return;

        const time = button.dataset.time as any; 
        const currentlySelected = state.editingHabit.formData.times.includes(time);

        if (currentlySelected) {
            // Impede desmarcar o último horário (deve haver pelo menos um)
            if (state.editingHabit.formData.times.length > 1) {
                state.editingHabit.formData.times = state.editingHabit.formData.times.filter(t => t !== time);
                button.classList.remove('selected');
            }
        } else {
            state.editingHabit.formData.times.push(time);
            button.classList.add('selected');
        }
    });

    // Configurações de Frequência
    ui.frequencyOptionsContainer.addEventListener('change', e => {
        const target = e.target as HTMLElement;
        if (target.matches('input[name="frequency-type"]')) {
            _handleFrequencyTypeChange(target as HTMLInputElement);
        } else if (target.closest('.weekday-picker input')) {
            _handleWeekdaySelectionChange();
        }
    });

    ui.frequencyOptionsContainer.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const btn = target.closest<HTMLButtonElement>('.stepper-btn, .unit-toggle-btn');
        if (btn) {
            _handleIntervalControlChange(btn);
        }
    });
}
