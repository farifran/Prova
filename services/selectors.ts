
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/selectors.ts
 * @description Lógica de Seleção e Cálculo de Dados Derivados.
 */

import { state, Habit, TimeOfDay, HabitSchedule, getHabitDailyInfoForDate, STREAK_LOOKBACK_DAYS } from '../state';
import { toUTCIsoDateString, parseUTCIsoDate, addDays } from '../utils';

// --- Internal Cache for Static Dates ---
const _anchorDateCache = new Map<string, Date>();

function _getMemoizedDate(dateISO: string): Date {
    let date = _anchorDateCache.get(dateISO);
    if (!date) {
        date = parseUTCIsoDate(dateISO);
        _anchorDateCache.set(dateISO, date);
    }
    return date;
}

export function clearSelectorCaches() {
    _anchorDateCache.clear();
}

export function getScheduleForDate(habit: Habit, dateISO: string): HabitSchedule | undefined {
    // Iterate history reversely (newest first)
    for (let i = habit.scheduleHistory.length - 1; i >= 0; i--) {
        const schedule = habit.scheduleHistory[i];
        // Assuming inclusive start, exclusive end if present? Or inclusive? 
        // Standard convention: inclusive start, inclusive end if set.
        if (dateISO >= schedule.startDate && (!schedule.endDate || dateISO <= schedule.endDate)) {
            return schedule;
        }
    }
    return undefined;
}

export function getEffectiveScheduleForHabitOnDate(habit: Habit, dateISO: string): TimeOfDay[] {
    const dailyInfo = state.dailyData[dateISO]?.[habit.id];
    if (dailyInfo?.dailySchedule) {
        return dailyInfo.dailySchedule;
    }

    const schedule = getScheduleForDate(habit, dateISO);
    if (!schedule) return [];

    const freq = schedule.frequency;
    
    if (freq.type === 'daily') {
        return schedule.times;
    } else if (freq.type === 'specific_days_of_week') {
        const date = _getMemoizedDate(dateISO);
        const dayOfWeek = date.getUTCDay();
        if (freq.days.includes(dayOfWeek)) {
            return schedule.times;
        }
    } else if (freq.type === 'interval') {
        const anchor = schedule.scheduleAnchor;
        if (!anchor) return schedule.times;

        const startDate = _getMemoizedDate(anchor);
        const targetDate = _getMemoizedDate(dateISO);
        
        const diffTime = targetDate.getTime() - startDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        let intervalDays = freq.amount;
        if (freq.unit === 'weeks') intervalDays *= 7;
        
        if (diffDays >= 0 && diffDays % intervalDays === 0) {
            return schedule.times;
        }
    }

    return [];
}

export function getActiveHabitsForDate(dateISO: string, dateObj?: Date): Array<{ habit: Habit; schedule: TimeOfDay[] }> {
    const active: Array<{ habit: Habit; schedule: TimeOfDay[] }> = [];
    
    for (const habit of state.habits) {
        if (habit.graduatedOn && dateISO > habit.graduatedOn) continue;
        
        const scheduleTimes = getEffectiveScheduleForHabitOnDate(habit, dateISO);
        if (scheduleTimes.length > 0) {
            active.push({ habit, schedule: scheduleTimes });
        }
    }
    return active;
}

export function getSmartGoalForHabit(habit: Habit, dateISO: string, time: TimeOfDay): number {
    // Placeholder for smarter logic (e.g. ramping up)
    return habit.goal.total || 0;
}

export function calculateHabitStreak(habitId: string, referenceDateISO: string): number {
    const habit = state.habits.find(h => h.id === habitId);
    if (!habit) return 0;

    let streak = 0;
    const date = parseUTCIsoDate(referenceDateISO);
    let currentCheckDate = date;
    
    for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
        const iso = toUTCIsoDateString(currentCheckDate);
        
        const scheduleTimes = getEffectiveScheduleForHabitOnDate(habit, iso);
        if (scheduleTimes.length === 0) {
            // Skip days don't break streak
            currentCheckDate = addDays(currentCheckDate, -1);
            continue;
        }
        
        const dayInfo = getHabitDailyInfoForDate(iso)[habitId];
        const instances = dayInfo?.instances || {};
        
        let allDone = true;
        
        for (const time of scheduleTimes) {
            const status = instances[time]?.status;
            if (status !== 'completed' && status !== 'snoozed') {
                allDone = false;
                break;
            }
        }
        
        if (allDone) {
            streak++;
        } else if (i > 0) {
            // Break streak if previous day missed
            break;
        }
        // If i==0 (today) and not done, we just don't count it yet
        
        currentCheckDate = addDays(currentCheckDate, -1);
    }
    
    return streak;
}

export function calculateDaySummary(dateISO: string, dateObj?: Date): { total: number; completed: number; snoozed: number; pending: number; completedPercent: number; snoozedPercent: number; showPlusIndicator: boolean } {
    const habits = state.habits;
    let total = 0;
    let completed = 0;
    let snoozed = 0;
    
    const dailyInfo = getHabitDailyInfoForDate(dateISO);
    
    for (const habit of habits) {
        if (habit.graduatedOn && dateISO > habit.graduatedOn) continue;
        
        const scheduleTimes = getEffectiveScheduleForHabitOnDate(habit, dateISO);
        
        if (scheduleTimes.length > 0) {
            const instances = dailyInfo[habit.id]?.instances || {};
            
            for (const time of scheduleTimes) {
                total++;
                const status = instances[time]?.status;
                if (status === 'completed') completed++;
                else if (status === 'snoozed') snoozed++;
            }
        }
    }
    
    const pending = total - completed - snoozed;
    const completedPercent = total === 0 ? 0 : Math.round((completed / total) * 100);
    const snoozedPercent = total === 0 ? 0 : Math.round((snoozed / total) * 100);
    const showPlusIndicator = total > 0 && completed === total;

    return { total, completed, snoozed, pending, completedPercent, snoozedPercent, showPlusIndicator };
}

export function isHabitNameDuplicate(name: string, excludeHabitId?: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    
    for (const habit of state.habits) {
        if (excludeHabitId && habit.id === excludeHabitId) continue;
        
        const currentSchedule = habit.scheduleHistory[habit.scheduleHistory.length - 1];
        if (currentSchedule.name && currentSchedule.name.toLowerCase() === normalizedName) return true;
    }
    return false;
}
