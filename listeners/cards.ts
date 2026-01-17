/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/cards.ts
 * @description Controlador de Interação dos Cartões de Hábito.
 */

import { ui } from '../render/ui';
import { 
    state, 
    TimeOfDay, 
    Habit, 
    getNextStatus, 
    HabitStatus, 
    ensureHabitInstanceData, 
    getHabitDailyInfoForDate,
    invalidateChartCache
} from '../state';
import { saveState } from '../services/persistence';
import { renderApp, openNotesModal } from '../render';
import { DOM_SELECTORS, CSS_CLASSES } from '../render/constants';
import { triggerHaptic } from '../utils';
import { setGoalOverride } from '../habitActions';

function getCurrentGoalForInstance(habit: Habit, date: string, time: TimeOfDay): number {
    const dayData = getHabitDailyInfoForDate(date)[habit.id]?.instances[time];
    return dayData?.goalOverride ?? habit.goal.total ?? 0;
}

function createGoalInput(habit: Habit, time: TimeOfDay, wrapper: HTMLElement) {
    if (wrapper.querySelector('input')) return; // Já está no modo de edição

    const originalContent = wrapper.innerHTML;
    const currentGoal = getCurrentGoalForInstance(habit, state.selectedDate, time);
    
    // DOM MANIPULATION: Swap text for input directly.
    wrapper.innerHTML = `<input type="number" class="goal-input-inline" value="${currentGoal}" min="1" step="1" inputmode="numeric" pattern="[0-9]*" />`;
    const input = wrapper.querySelector('input')!;
    input.focus();
    input.select();

    // MEMORY MANAGEMENT: Manual cleanup of temporary listeners to prevent leaks.
    const cleanupListeners = () => {
        input.removeEventListener('blur', onBlur);
        input.removeEventListener('keydown', onKeyDown);
    };

    const restoreOriginalContent = () => {
        cleanupListeners();
        wrapper.innerHTML = originalContent;
    };

    // RACE CONDITION FIX: Flag para evitar salvamento duplo (Enter + Blur).
    let isSaving = false;

    const save = () => {
        if (isSaving) return;
        isSaving = true;

        const newGoal = parseInt(input.value, 10);
        
        if (!isNaN(newGoal) && newGoal > 0) {
            // PERFORMANCE [2025-03-16]: Skip restoreOriginalContent().
            // CRITICAL ARCHITECTURE: Otimização de "Race-to-Idle".
            // A função setGoalOverride dispara um renderApp() completo via Event Bus.
            // Não restauramos o conteúdo antigo aqui para evitar "Layout Thrashing" (Write -> Read -> Write).
            // Deixamos o motor de renderização reconstruir o estado correto no próximo frame.
            cleanupListeners();
            
            setGoalOverride(habit.id, state.selectedDate, time, newGoal);
            triggerHaptic('success');

            // Reuse 'wrapper' reference directly for simple feedback animation
            requestAnimationFrame(() => {
                wrapper.classList.add('increase');
                wrapper.addEventListener('animationend', () => wrapper.classList.remove('increase'), { once: true });
            });
            
            // A11Y FIX: Restore focus efficiently.
            // We use closest() here only on success, which is rare compared to reads.
            const card = wrapper.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
            const content = card?.querySelector<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
            content?.focus();
        } else {
            // Invalid input: restore previous state immediately
            restoreOriginalContent();
        }
    };

    const onBlur = () => save();
    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur(); // Triggers onBlur -> save
        } else if (e.key === 'Escape') {
            // Cancelamento não deve salvar
            if (isSaving) return; 
            restoreOriginalContent();
            // A11Y: Restore focus on cancel
            const card = wrapper.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
            const content = card?.querySelector<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
            content?.focus();
        }
    };
    
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKeyDown);
}

export function setupCardListeners() {
    ui.habitContainer.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const card = target.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        
        // --- 1. Goal Adjustment (Decrement) ---
        if (target.matches(`[data-action="decrement"]`)) {
            const btn = target as HTMLButtonElement;
            const habitId = btn.dataset.habitId!;
            const time = btn.dataset.time as TimeOfDay;
            const habit = state.habits.find(h => h.id === habitId);
            
            if (habit) {
                const currentGoal = getCurrentGoalForInstance(habit, state.selectedDate, time);
                if (currentGoal > 1) {
                    setGoalOverride(habitId, state.selectedDate, time, currentGoal - 1);
                    triggerHaptic('light');
                }
            }
            return;
        }

        // --- 2. Goal Adjustment (Increment) ---
        if (target.matches(`[data-action="increment"]`)) {
            const btn = target as HTMLButtonElement;
            const habitId = btn.dataset.habitId!;
            const time = btn.dataset.time as TimeOfDay;
            const habit = state.habits.find(h => h.id === habitId);
            
            if (habit) {
                const currentGoal = getCurrentGoalForInstance(habit, state.selectedDate, time);
                setGoalOverride(habitId, state.selectedDate, time, currentGoal + 1);
                triggerHaptic('light');
                
                // Feedback visual rápido
                const wrapper = btn.closest(DOM_SELECTORS.HABIT_GOAL_CONTROLS);
                if (wrapper) {
                    wrapper.classList.add('increase');
                    wrapper.addEventListener('animationend', () => wrapper.classList.remove('increase'), { once: true });
                }
            }
            return;
        }

        // --- 3. Goal Inline Editing (Click on value/unit) ---
        if (target.matches('.goal-value-wrapper, .goal-value-wrapper *')) {
            const wrapper = target.closest<HTMLElement>(DOM_SELECTORS.GOAL_VALUE_WRAPPER);
            const controls = wrapper?.closest<HTMLElement>(DOM_SELECTORS.HABIT_GOAL_CONTROLS);
            if (wrapper && controls) {
                const decBtn = controls.querySelector(`[data-action="decrement"]`) as HTMLElement;
                const habitId = decBtn.dataset.habitId!;
                const time = decBtn.dataset.time as TimeOfDay;
                const habit = state.habits.find(h => h.id === habitId);
                
                if (habit) {
                    createGoalInput(habit, time, wrapper);
                }
            }
            return;
        }

        // --- 4. Main Card Toggle Action ---
        if (card && card.dataset.habitId && card.dataset.time) {
            // Ignore if clicking internal buttons (handled above or by Swipe)
            if (target.closest('button') || target.closest('input')) return;

            const habitId = card.dataset.habitId;
            const time = card.dataset.time as TimeOfDay;
            
            const habit = state.habits.find(h => h.id === habitId);
            if (!habit) return;

            const dayData = getHabitDailyInfoForDate(state.selectedDate)[habitId]?.instances[time];
            const currentStatus = dayData?.status ?? 'pending';
            const nextStatus = getNextStatus(currentStatus);

            triggerHaptic('selection');
            ensureHabitInstanceData(state.selectedDate, habitId, time).status = nextStatus;
            
            saveState();
            
            // CRITICAL FIX: Update dirty flags to force re-render of components.
            // renderHabits() bails out if this flag is false.
            state.uiDirtyState.habitListStructure = true; // Updates Cards Content
            state.uiDirtyState.calendarVisuals = true;    // Updates Calendar Rings
            invalidateChartCache();                       // Updates Chart Data
            
            renderApp();
        }
    });
}