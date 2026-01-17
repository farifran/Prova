
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file state.ts
 * @description Definição do Estado Global e Estruturas de Dados (Single Source of Truth).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo reside na thread principal e mantém o objeto de estado mutável.
 * 
 * ARQUITETURA (Mutable Singleton & Hierarchical Storage):
 * - **Cold Storage Compression:** Suporte a arquivos comprimidos GZIP.
 * - **Lazy Async Hydration:** Se um arquivo comprimido for solicitado, o sistema retorna um objeto vazio
 *   enquanto dispara a descompressão em background, re-renderizando a UI quando pronto.
 */

import { addDays, getTodayUTC, getTodayUTCIso, decompressString } from './utils';

// --- TYPES & INTERFACES ---
export type HabitStatus = 'completed' | 'snoozed' | 'pending';

export type Frequency =
    | { type: 'daily' }
    | { type: 'interval'; unit: 'days' | 'weeks'; amount: number }
    | { type: 'specific_days_of_week'; days: number[] }; // Sun=0, Mon=1, ...

export interface HabitDayData {
    status: HabitStatus;
    goalOverride?: number;
    note?: string;
}

export type HabitDailyInstances = Partial<Record<TimeOfDay, HabitDayData>>;

// The data for a single habit on a single day
export interface HabitDailyInfo {
    instances: HabitDailyInstances;
    dailySchedule?: TimeOfDay[]; // Override for habit.times for this day
}

// CRITICAL LOGIC: Time-Travel Structure.
export interface HabitSchedule {
    startDate: string;
    endDate?: string;
    name?: string;
    subtitle?: string;
    nameKey?: string;
    subtitleKey?: string;
    times: TimeOfDay[];
    frequency: Frequency;
    scheduleAnchor: string;
}

export interface Habit {
    id: string;
    icon: string;
    color: string;
    goal: { 
        type: 'pages' | 'minutes' | 'check'; 
        total?: number; 
        unitKey?: string;
    };
    createdOn: string;
    graduatedOn?: string;
    // Histórico linear ordenado cronologicamente. O último item é o estado "atual".
    scheduleHistory: HabitSchedule[];
}

export type PredefinedHabit = {
    nameKey: string;
    subtitleKey: string;
    icon: string;
    color: string;
    times: TimeOfDay[];
    goal: {
        type: 'pages' | 'minutes' | 'check';
        total?: number;
        unitKey: string;
    };
    frequency: Frequency;
    isDefault?: boolean;
};

export type HabitTemplate = {
    icon: string;
    color: string;
    times: TimeOfDay[];
    goal: Habit['goal'];
    frequency: Frequency;
} & ({
    nameKey: string;
    subtitleKey: string;
    name?: never;
    subtitle?: never;
} | {
    name: string;
    subtitleKey: string;
    nameKey?: never;
    subtitle?: never;
});


// Nova interface para o estado completo da aplicação
export interface AppState {
    version: number;
    lastModified: number;
    habits: Habit[];
    // PERFORMANCE: Hot Storage. Acesso direto O(1).
    dailyData: Record<string, Record<string, HabitDailyInfo>>; // HOT STORAGE (Last 90 days)
    // PERFORMANCE: Cold Storage. GZIP Strings (Prefix: "GZIP:") or Legacy JSON Strings.
    archives: Record<string, string>; 
    notificationsShown: string[];
    pending21DayHabitIds: string[];
    pendingConsolidationHabitIds: string[];
    // Propriedades do estado da IA
    aiState?: 'idle' | 'loading' | 'completed' | 'error';
    lastAIResult?: string | null;
    lastAIError?: string | null;
    hasSeenAIResult?: boolean;
}


// --- CONSTANTS ---
export const APP_VERSION = 6; 
export const DAYS_IN_CALENDAR = 61;
export const STREAK_SEMI_CONSOLIDATED = 21;
export const STREAK_CONSOLIDATED = 66;
export const STREAK_LOOKBACK_DAYS = 730;

export const TIMES_OF_DAY = ['Morning', 'Afternoon', 'Evening'] as const;
export type TimeOfDay = typeof TIMES_OF_DAY[number];

export const LANGUAGES = [
    { code: 'pt', nameKey: 'langPortuguese' },
    { code: 'en', nameKey: 'langEnglish' },
    { code: 'es', nameKey: 'langSpanish' }
] as const;
export type Language = typeof LANGUAGES[number];

export const FREQUENCIES = [
    { labelKey: 'freqDaily', value: { type: 'daily' } },
    { labelKey: 'freqEvery', value: { type: 'interval', unit: 'days', amount: 2 } },
    { labelKey: 'freqSpecificDaysOfWeek', value: { type: 'specific_days_of_week', days: [] } }
] as const;

// --- HELPERS ---
export function getNextStatus(currentStatus: HabitStatus): HabitStatus {
    const transitions: Record<HabitStatus, HabitStatus> = {
        pending: 'completed',
        completed: 'snoozed',
        snoozed: 'pending',
    };
    return transitions[currentStatus];
}

// --- APPLICATION STATE ---
export const state: {
    habits: Habit[];
    dailyData: Record<string, Record<string, HabitDailyInfo>>; // HOT STORAGE (Last 90 days)
    archives: Record<string, string>; // COLD STORAGE (GZIP/JSON Strings)
    // RUNTIME CACHE [2025-02-23]: Holds parsed archive data in memory.
    unarchivedCache: Map<string, Record<string, Record<string, HabitDailyInfo>>>;
    
    // PERFORMANCE [2025-03-15]: Nested Maps for O(1) access.
    streaksCache: Map<string, Map<string, number>>;
    habitAppearanceCache: Map<string, Map<string, boolean>>;
    scheduleCache: Map<string, Map<string, HabitSchedule | null>>;
    
    // Flat caches
    activeHabitsCache: Map<string, Array<{ habit: Habit; schedule: TimeOfDay[] }>>;
    daySummaryCache: Map<string, any>;
    
    calendarDates: Date[];
    selectedDate: string;
    activeLanguageCode: Language['code'];
    pending21DayHabitIds: string[];
    pendingConsolidationHabitIds: string[];
    notificationsShown: string[];
    confirmAction: (() => void) | null;
    confirmEditAction: (() => void) | null;
    editingNoteFor: { habitId: string; date: string; time: TimeOfDay; } | null;
    editingHabit: {
        isNew: boolean;
        habitId?: string;
        originalData?: Habit;
        formData: HabitTemplate;
        targetDate: string;
    } | null;
    aiState: 'idle' | 'loading' | 'completed' | 'error';
    hasSeenAIResult: boolean;
    lastAIResult: string | null;
    lastAIError: string | null;
    syncState: 'syncSaving' | 'syncSynced' | 'syncError' | 'syncInitial';
    fullCalendar: {
        year: number;
        month: number;
    };
    uiDirtyState: {
        calendarVisuals: boolean;
        habitListStructure: boolean;
        chartData: boolean;
    };
} = {
    habits: [],
    dailyData: {},
    archives: {},
    unarchivedCache: new Map(),
    streaksCache: new Map(),
    habitAppearanceCache: new Map(),
    scheduleCache: new Map(),
    activeHabitsCache: new Map(),
    daySummaryCache: new Map(),
    calendarDates: Array.from({ length: DAYS_IN_CALENDAR }, (_, i) => addDays(getTodayUTC(), i - 30)),
    selectedDate: getTodayUTCIso(),
    activeLanguageCode: 'pt',
    pending21DayHabitIds: [],
    pendingConsolidationHabitIds: [],
    notificationsShown: [],
    confirmAction: null,
    confirmEditAction: null,
    editingNoteFor: null,
    editingHabit: null,
    aiState: 'idle',
    hasSeenAIResult: true,
    lastAIResult: null,
    lastAIError: null,
    syncState: 'syncInitial',
    fullCalendar: {
        year: new Date().getFullYear(),
        month: new Date().getMonth(),
    },
    uiDirtyState: {
        calendarVisuals: true,
        habitListStructure: true,
        chartData: true,
    }
};

// --- CACHE MANAGEMENT ---
export function isChartDataDirty(): boolean {
    const wasDirty = state.uiDirtyState.chartData;
    if (wasDirty) {
        state.uiDirtyState.chartData = false;
    }
    return wasDirty;
}

export function invalidateChartCache() {
    state.uiDirtyState.chartData = true;
}

export function getPersistableState(): AppState {
    return {
        version: APP_VERSION,
        lastModified: Date.now(),
        habits: state.habits,
        dailyData: state.dailyData,
        archives: state.archives,
        notificationsShown: state.notificationsShown,
        pending21DayHabitIds: state.pending21DayHabitIds,
        pendingConsolidationHabitIds: state.pendingConsolidationHabitIds
    };
}

export function clearScheduleCache() {
    state.scheduleCache.clear();
    state.activeHabitsCache.clear();
    state.habitAppearanceCache.clear();
    state.streaksCache.clear();
    state.daySummaryCache.clear();
    state.uiDirtyState.chartData = true;
}

export function clearActiveHabitsCache() {
    state.activeHabitsCache.clear();
    state.habitAppearanceCache.clear();
    state.streaksCache.clear();
    state.daySummaryCache.clear();
    state.uiDirtyState.chartData = true;
}

export function invalidateCachesForDateChange(dateISO: string, habitIds: string[]) {
    state.uiDirtyState.chartData = true;
    state.daySummaryCache.delete(dateISO);
    
    habitIds.forEach(id => {
        state.streaksCache.delete(id);
    });
}

const EMPTY_DAILY_INFO = Object.freeze({});

/**
 * LAZY LOADING ACCESSOR [2025-02-23]:
 * Recupera dados diários com suporte a GZIP Async.
 * 
 * CRITICAL LOGIC: Lazy Hydration.
 * Se o arquivo estiver comprimido, esta função retorna um objeto vazio inicialmente,
 * dispara a descompressão em background e atualiza a UI quando pronto.
 */
export function getHabitDailyInfoForDate(date: string): Record<string, HabitDailyInfo> {
    // 1. Check Hot Storage (Fastest)
    if (state.dailyData[date]) {
        return state.dailyData[date];
    }

    // 2. Check Archive
    const year = date.substring(0, 4);
    
    // Warm Cache (Memory)
    if (state.unarchivedCache.has(year)) {
        const yearData = state.unarchivedCache.get(year)!;
        return yearData[date] || (EMPTY_DAILY_INFO as Record<string, HabitDailyInfo>);
    }

    // Cold Storage Check
    if (state.archives[year]) {
        const raw = state.archives[year];
        
        // NEW: GZIP Handling (Async Hydration)
        if (raw.startsWith('GZIP:')) {
            const pendingKey = `${year}_pending`;
            
            // Check Lock: Se já estamos descomprimindo, não inicia outra promessa.
            if (!state.unarchivedCache.has(pendingKey)) {
                // Set Lock
                state.unarchivedCache.set(pendingKey, {});
                
                console.log(`Decompressing archive for year ${year} in background...`);
                
                // Fire and Forget (Async)
                decompressString(raw.substring(5)).then(json => {
                    try {
                        const parsedYearData = JSON.parse(json);
                        // Save to Cache
                        state.unarchivedCache.set(year, parsedYearData);
                        // Remove Lock
                        state.unarchivedCache.delete(pendingKey);
                        
                        // Force Re-render to show data
                        console.log(`Archive ${year} hydrated. Re-rendering.`);
                        document.dispatchEvent(new CustomEvent('render-app'));
                    } catch (e) {
                        console.error(`Failed to decompress/parse archive ${year}`, e);
                        state.unarchivedCache.delete(pendingKey);
                    }
                });
            }
            
            // Return empty while loading
            return (EMPTY_DAILY_INFO as Record<string, HabitDailyInfo>);
        } 
        else {
            // Legacy JSON (Synchronous)
            try {
                // PERFORMANCE WARNING: JSON.parse on main thread for large files.
                // Only happens for old archives not yet converted to GZIP.
                const parsedYearData = JSON.parse(raw) as Record<string, Record<string, HabitDailyInfo>>;
                state.unarchivedCache.set(year, parsedYearData);
                return parsedYearData[date] || (EMPTY_DAILY_INFO as Record<string, HabitDailyInfo>);
            } catch (e) {
                console.error(`Error parsing legacy archive for ${year}`, e);
            }
        }
    }

    return (EMPTY_DAILY_INFO as Record<string, HabitDailyInfo>);
}

export function ensureHabitDailyInfo(date: string, habitId: string): HabitDailyInfo {
    if (!state.dailyData[date]) {
        const archivedDay = getHabitDailyInfoForDate(date);
        
        if (archivedDay !== EMPTY_DAILY_INFO) {
            // Thaw: Copy from archive to hot storage
            state.dailyData[date] = structuredClone(archivedDay);
        } else {
            // New day
            state.dailyData[date] = {};
        }
    }

    state.dailyData[date][habitId] ??= { instances: {} };
    return state.dailyData[date][habitId];
}

export function ensureHabitInstanceData(date: string, habitId: string, time: TimeOfDay): HabitDayData {
    ensureHabitDailyInfo(date, habitId);
    state.dailyData[date][habitId].instances[time] ??= { status: 'pending' };
    return state.dailyData[date][habitId].instances[time]!;
}
