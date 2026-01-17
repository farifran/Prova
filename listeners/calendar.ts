
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/calendar.ts
 * @description Controlador de Interação do Calendário (Strip & Full Almanac).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia entradas de alta frequência (scroll, pointer events).
 * A performance é crítica para garantir que a navegação por datas seja fluida (60fps).
 * 
 * ARQUITETURA:
 * - Event Delegation: Escuta eventos no container pai (`ui.calendarStrip`) para evitar
 *   anexar listeners em cada dia individualmente (O(1) vs O(N)).
 * - Gesture Recognition: Implementa lógica manual de "Long Press" vs "Click" usando `pointerdown` e timers.
 * - Manual Layout Calculation: Calcula a posição do modal de "Ações Rápidas" via JS para
 *   evitar dependências de libs de posicionamento (ex: Popper.js) e manter o bundle leve.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `render/ui.ts`: Acesso direto ao DOM cacheado.
 * - `state.ts`: Mutação de datas e flags de renderização.
 */

import { ui } from '../render/ui';
import { state, DAYS_IN_CALENDAR, invalidateChartCache } from '../state';
import { renderApp, renderFullCalendar, openModal, scrollToToday, closeModal } from '../render';
import { parseUTCIsoDate, triggerHaptic, getTodayUTCIso, addDays, toUTCIsoDateString } from '../utils';
import { DOM_SELECTORS } from '../render/constants';
import { markAllHabitsForDate } from '../habitActions';

/**
 * Atualiza o estado global e força um ciclo de renderização.
 * PERFORMANCE: Define explicitamente as flags de 'dirty' para evitar verificações desnecessárias
 * em partes da UI que não mudaram (ex: rodapés estáticos), focando no núcleo da experiência.
 */
function updateSelectedDateAndRender(date: string) {
    state.selectedDate = date;
    state.uiDirtyState.calendarVisuals = true;
    state.uiDirtyState.habitListStructure = true;
    state.uiDirtyState.chartData = true;
    renderApp();
}

export function setupCalendarListeners() {
    const LONG_PRESS_DURATION = 500;
    let longPressTimer: number | null = null;
    let isLongPress = false;
    let activeQuickActionDate: string | null = null;

    const openAlmanac = () => {
        // PERFORMANCE: Calcula apenas o necessário para abrir o modal
        state.fullCalendar = {
            year: parseUTCIsoDate(state.selectedDate).getUTCFullYear(),
            month: parseUTCIsoDate(state.selectedDate).getUTCMonth()
        };
        renderFullCalendar();
        openModal(ui.fullCalendarModal);
    };

    const clearTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    // CRITICAL LOGIC: Gesture Recognition (Long Press).
    // Implementa uma máquina de estados simples para diferenciar clique de toque longo.
    // Usa 'pointerdown' para suportar mouse e toque unificadamente.
    ui.calendarStrip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return; // Apenas botão esquerdo/toque principal
        const dayItem = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.DAY_ITEM);
        if (!dayItem || !dayItem.dataset.date) return;

        const dateISO = dayItem.dataset.date;

        isLongPress = false;
        longPressTimer = window.setTimeout(() => {
            isLongPress = true;
            dayItem.classList.add('is-pressing');
            triggerHaptic('medium');
            
            activeQuickActionDate = dateISO;

            // MANUAL LAYOUT CALCULATION:
            // Posiciona o modal de ações rápidas (Popover) relativo ao elemento clicado.
            // Evita reflows caros calculando apenas quando o evento ocorre.
            const rect = dayItem.getBoundingClientRect();
            const modal = ui.calendarQuickActions;
            const modalContent = modal.querySelector<HTMLElement>('.quick-actions-content');

            if (!modalContent) return;

            const top = rect.bottom + 8;
            const centerPoint = rect.left + rect.width / 2;
            const modalWidth = 240; // Based on min-width in CSS
            const windowWidth = window.innerWidth;
            const padding = 8; // Screen edge padding

            let finalLeft = centerPoint;
            let translateX = '-50%';

            const halfModalWidth = modalWidth / 2;
            const leftEdge = centerPoint - halfModalWidth;
            const rightEdge = centerPoint + halfModalWidth;

            // Edge Detection: Mantém o modal dentro da tela
            if (leftEdge < padding) {
                finalLeft = padding;
                translateX = '0%';
            } else if (rightEdge > windowWidth - padding) {
                finalLeft = windowWidth - padding;
                translateX = '-100%';
            }

            // PERFORMANCE: Usa variáveis CSS para posicionamento eficiente (Composite Layer).
            modal.style.setProperty('--actions-top', `${top}px`);
            modal.style.setProperty('--actions-left', `${finalLeft}px`);
            modalContent.style.setProperty('--translate-x', translateX);

            openModal(modal, undefined, () => {
                activeQuickActionDate = null;
            });

        }, LONG_PRESS_DURATION);

        // Limpeza única (Self-destruct listener)
        const clearPressing = () => {
            dayItem.classList.remove('is-pressing');
            window.removeEventListener('pointerup', clearPressing);
            window.removeEventListener('pointercancel', clearPressing);
        };
        window.addEventListener('pointerup', clearPressing, { once: true });
        window.addEventListener('pointercancel', clearPressing, { once: true });
    });
    
    // Cancela o timer se o usuário mover o dedo (scroll) ou soltar antes do tempo.
    ui.calendarStrip.addEventListener('pointerup', clearTimer);
    ui.calendarStrip.addEventListener('pointercancel', clearTimer);
    ui.calendarStrip.addEventListener('pointerleave', clearTimer);
    ui.calendarStrip.addEventListener('scroll', clearTimer);

    // PERFORMANCE: Event Delegation.
    // Um único listener no container gerencia cliques em todos os dias.
    ui.calendarStrip.addEventListener('click', e => {
        // Se foi um Long Press, o evento de clique é suprimido/ignorado.
        if (isLongPress) {
            e.preventDefault();
            e.stopPropagation();
            isLongPress = false;
            return;
        }

        const dayItem = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.DAY_ITEM);
        if (!dayItem || !dayItem.dataset.date) return;

        triggerHaptic('selection');
        updateSelectedDateAndRender(dayItem.dataset.date);
    });
    
    // Quick Actions Listeners
    ui.quickActionDone.addEventListener('click', () => {
        if (activeQuickActionDate) {
            triggerHaptic('success');
            // Batch Operation: Marca múltiplos hábitos de uma vez
            if (markAllHabitsForDate(activeQuickActionDate, 'completed')) {
                renderApp();
            }
        }
        closeModal(ui.calendarQuickActions);
    });

    ui.quickActionSnooze.addEventListener('click', () => {
        if (activeQuickActionDate) {
            triggerHaptic('medium');
            if (markAllHabitsForDate(activeQuickActionDate, 'snoozed')) {
                renderApp();
            }
        }
        closeModal(ui.calendarQuickActions);
    });

    ui.quickActionAlmanac.addEventListener('click', () => {
        triggerHaptic('light');
        closeModal(ui.calendarQuickActions);
        openAlmanac();
    });

    // A11Y: Keyboard Navigation
    ui.calendarStrip.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        
        e.preventDefault();
        
        const currentDate = parseUTCIsoDate(state.selectedDate);
        let newDate: Date;
        
        if (e.key === 'ArrowLeft') {
            newDate = addDays(currentDate, -1);
        } else {
            newDate = addDays(currentDate, 1);
        }
        
        const newDateStr = toUTCIsoDateString(newDate);
        
        triggerHaptic('selection');
        updateSelectedDateAndRender(newDateStr);
        
        // UX: Garante que o foco siga a seleção e o elemento esteja visível
        requestAnimationFrame(() => {
            const newSelectedEl = ui.calendarStrip.querySelector<HTMLElement>(`${DOM_SELECTORS.DAY_ITEM}[data-date="${newDateStr}"]`);
            if (newSelectedEl) {
                newSelectedEl.focus();
                // 'smooth' scroll para contexto visual
                newSelectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });
    });

    // Reset to Today (Header Action)
    ui.headerTitle.addEventListener('click', () => {
        triggerHaptic('light');
        const today = getTodayUTCIso();
        const todayDate = parseUTCIsoDate(today);
        
        // Re-center calendar array around today
        state.calendarDates = Array.from({ length: DAYS_IN_CALENDAR }, (_, i) => 
            addDays(todayDate, i - 30)
        );

        updateSelectedDateAndRender(today);
        scrollToToday('smooth');
    });
}
