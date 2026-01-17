
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file habitActions.ts
 * @description Lógica de Mutação de Estado (Business Logic Layer).
 */

import { 
    state, Habit, HabitSchedule, TimeOfDay, ensureHabitDailyInfo, ensureHabitInstanceData, HabitStatus, clearScheduleCache, clearActiveHabitsCache, HabitDayData
} from './state';
import { saveState, clearLocalPersistence } from './services/persistence';
import { PREDEFINED_HABITS } from './data/predefinedHabits';
import { clearSelectorCaches } from './services/selectors';
import { generateUUID, getTodayUTCIso } from './utils';
import { t } from './i18n';
import { renderApp, closeModal, showConfirmationModal, openEditModal } from './render';
import { ui } from './render/ui';

// --- PRIVATE HELPERS ---

function _finalizeScheduleUpdate(affectsHistory: boolean = true) {
    if (affectsHistory) {
        clearScheduleCache();
        clearSelectorCaches();
    } else {
        clearActiveHabitsCache();
    }
    
    state.uiDirtyState.habitListStructure = true;
    state.uiDirtyState.chartData = true;
    state.uiDirtyState.calendarVisuals = true;
}

// --- ACTIONS ---

export function createDefaultHabit() {
    const defaultTemplate = PREDEFINED_HABITS.find(h => h.isDefault) || PREDEFINED_HABITS[0];
    const newHabit: Habit = {
        id: generateUUID(),
        icon: defaultTemplate.icon,
        color: defaultTemplate.color,
        goal: defaultTemplate.goal,
        createdOn: getTodayUTCIso(),
        scheduleHistory: [{
            startDate: getTodayUTCIso(),
            times: defaultTemplate.times,
            frequency: defaultTemplate.frequency,
            nameKey: defaultTemplate.nameKey,
            subtitleKey: defaultTemplate.subtitleKey,
            scheduleAnchor: getTodayUTCIso()
        }]
    };
    state.habits.push(newHabit);
    _finalizeScheduleUpdate();
    saveState();
}

export function handleDayTransition() {
    state.selectedDate = getTodayUTCIso();
    _finalizeScheduleUpdate(false);
    renderApp();
}

export function saveHabitFromModal() {
    if (!state.editingHabit) return;
    
    const { isNew, habitId, formData, targetDate } = state.editingHabit;
    
    if (isNew) {
        const newHabit: Habit = {
            id: generateUUID(),
            icon: formData.icon,
            color: formData.color,
            goal: formData.goal,
            createdOn: targetDate,
            scheduleHistory: [{
                startDate: targetDate,
                times: formData.times,
                frequency: formData.frequency,
                name: formData.name,
                nameKey: formData.nameKey,
                subtitleKey: formData.subtitleKey,
                scheduleAnchor: targetDate
            }]
        };
        state.habits.push(newHabit);
    } else if (habitId) {
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            const newSchedule: HabitSchedule = {
                startDate: targetDate,
                times: formData.times,
                frequency: formData.frequency,
                name: formData.name,
                nameKey: formData.nameKey, 
                subtitleKey: formData.subtitleKey,
                scheduleAnchor: targetDate
            };
            
            const lastSchedule = habit.scheduleHistory[habit.scheduleHistory.length - 1];
            if (lastSchedule.startDate === targetDate) {
                habit.scheduleHistory[habit.scheduleHistory.length - 1] = newSchedule;
            } else {
                lastSchedule.endDate = targetDate;
                habit.scheduleHistory.push(newSchedule);
            }
            
            habit.icon = formData.icon;
            habit.color = formData.color;
            habit.goal = formData.goal;
        }
    }
    
    _finalizeScheduleUpdate();
    saveState();
    closeModal(ui.editHabitModal);
    renderApp();
}

export function requestHabitEndingFromModal(habitId: string) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    showConfirmationModal(
        t('confirmEndHabit'),
        () => {
            const today = getTodayUTCIso();
            const lastSchedule = habit.scheduleHistory[habit.scheduleHistory.length - 1];
            lastSchedule.endDate = today;
            
            _finalizeScheduleUpdate();
            saveState();
            renderApp();
        },
        { title: t('habitEnd_ariaLabel'), confirmButtonStyle: 'danger' }
    );
}

export function requestHabitPermanentDeletion(habitId: string) {
    showConfirmationModal(
        t('confirmDeleteHabit'),
        () => {
            state.habits = state.habits.filter(h => h.id !== habitId);
            _finalizeScheduleUpdate();
            saveState();
            renderApp();
        },
        { title: t('aria_delete_permanent', { habitName: '' }), confirmButtonStyle: 'danger' }
    );
}

export function requestHabitEditingFromModal(habitId: string) {
    const habit = state.habits.find(h => h.id === habitId);
    if (habit) {
        openEditModal(habit);
    }
}

export function resetApplicationData() {
    clearLocalPersistence().then(() => {
        window.location.reload();
    });
}

export function handleSaveNote() {
    if (state.editingNoteFor) {
        const { habitId, date, time } = state.editingNoteFor;
        const text = ui.notesTextarea.value;
        
        ensureHabitInstanceData(date, habitId, time).note = text;
        
        saveState();
        closeModal(ui.notesModal);
        state.editingNoteFor = null;
        renderApp();
    }
}

export function graduateHabit(habitId: string) {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    habit.graduatedOn = getTodayUTCIso();
    _finalizeScheduleUpdate();
    saveState();
    renderApp();
}

export async function performAIAnalysis(analysisType: 'monthly' | 'quarterly' | 'historical') {
    state.aiState = 'loading';
    renderApp();
    
    try {
        // Mock success for now, logic would reside in cloud.ts or similar
        state.aiState = 'completed';
        state.lastAIResult = "AI Analysis (Mock)";
        state.hasSeenAIResult = false;
    } catch(e) {
        state.aiState = 'error';
        state.lastAIError = String(e);
    }
    
    saveState();
    renderApp();
}

export function exportData() {
    // Implementation omitted for brevity, usually creates a JSON download
}

export function importData() {
    // Implementation omitted for brevity, usually triggers file input
}

export function handleHabitDrop(habitId: string, fromTime: TimeOfDay, toTime: TimeOfDay, reorderTarget?: { id: string, pos: 'before' | 'after' }) {
    // Placeholder for complex drag logic
    _finalizeScheduleUpdate();
    saveState();
    renderApp();
}

export function reorderHabit(habitId: string, targetId: string, position: 'before' | 'after') {
    const fromIndex = state.habits.findIndex(h => h.id === habitId);
    const toIndex = state.habits.findIndex(h => h.id === targetId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const [moved] = state.habits.splice(fromIndex, 1);
    const newIndex = position === 'before' ? toIndex : toIndex + 1;
    state.habits.splice(fromIndex < toIndex ? newIndex - 1 : newIndex, 0, moved);
    
    _finalizeScheduleUpdate();
    saveState();
    renderApp();
}

export function markAllHabitsForDate(dateISO: string, status: HabitStatus): boolean {
    // Placeholder
    saveState();
    return true;
}

export function setGoalOverride(habitId: string, date: string, time: TimeOfDay, value: number) {
    ensureHabitInstanceData(date, habitId, time).goalOverride = value;
    saveState();
    renderApp();
}
