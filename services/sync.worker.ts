
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/sync.worker.ts
 * @description Web Worker para Processamento Pesado (CPU-Bound Tasks).
 * 
 * [WORKER CONTEXT]:
 * Este código roda em uma thread isolada.
 * 
 * ARQUITETURA (Off-Main-Thread):
 * - **Responsabilidade Única:** Executar tarefas que bloqueiam a thread principal.
 * - **GZIP Parsing:** Detecta arquivos comprimidos (`GZIP:...`) e usa `decompressString` 
 *   para acessá-los sob demanda, sem bloquear a geração do prompt de IA.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `utils.ts`: Funções de data e compressão.
 * - `crypto.ts`: Criptografia.
 */

import type { AppState, Habit, HabitDailyInfo } from '../state';
import { toUTCIsoDateString, parseUTCIsoDate, decompressString, compressString } from '../utils';
import { encrypt, decrypt } from './crypto';

// --- AI Prompt Building Logic ---

type AIPromptPayload = {
    analysisType: 'monthly' | 'quarterly' | 'historical';
    habits: Habit[];
    dailyData: AppState['dailyData'];
    archives: AppState['archives'];
    languageName: string;
    translations: {
        promptTemplate: string;
        aiPromptGraduatedSection: string;
        aiPromptNoData: string;
        aiPromptNone: string;
        aiSystemInstruction: string;
        [key: string]: string; // For habit name keys
    };
    todayISO: string;
};

function getHabitDisplayInfo(habit: Habit, translations: Record<string, string>, dateISO: string): { name: string } {
    const schedule = habit.scheduleHistory.find(s => s.startDate <= dateISO && (!s.endDate || s.endDate > dateISO)) || habit.scheduleHistory[habit.scheduleHistory.length - 1];
    
    if (schedule.nameKey && translations[schedule.nameKey]) {
        return { name: translations[schedule.nameKey] };
    }
    return { name: schedule.name || habit.id };
}

// Alterado para async para suportar descompressão
async function _getHistoryForPrompt(
    days: number,
    habits: Habit[],
    dailyData: AppState['dailyData'],
    archives: AppState['archives'],
    todayISO: string,
    translations: Record<string, string>
): Promise<string> {
    let history = '';
    const date = parseUTCIsoDate(todayISO);
    
    // PERFORMANCE [WORKER-SIDE CACHE]: Caches parsed archive JSON.
    const unarchivedCache = new Map<string, any>();
    
    const getDailyDataForDate = async (dateStr: string): Promise<Record<string, HabitDailyInfo>> => {
        // Hot Storage check
        if (dailyData[dateStr]) return dailyData[dateStr];
        
        const year = dateStr.substring(0, 4);
        
        // Warm Cache check
        if (unarchivedCache.has(year)) {
            return unarchivedCache.get(year)[dateStr] || {};
        }

        // Cold Storage access
        if (archives[year]) {
            try {
                let parsed: any;
                const raw = archives[year];
                
                // DECOMPRESSION LOGIC: Detect GZIP signature
                if (raw.startsWith('GZIP:')) {
                    const json = await decompressString(raw.substring(5));
                    parsed = JSON.parse(json);
                } else {
                    // Legacy Format (Plain JSON String)
                    parsed = JSON.parse(raw);
                }
                
                unarchivedCache.set(year, parsed);
                return parsed[dateStr] || {};
            } catch (e) {
                console.warn(`Worker failed to parse/decompress archive for year ${year}`, e);
                return {};
            }
        }
        return {};
    };

    // PERFORMANCE: Loop reverso cronológico.
    for (let i = 0; i < days; i++) {
        const currentDateISO = toUTCIsoDateString(date);
        const dayRecord = await getDailyDataForDate(currentDateISO); // Await aqui é seguro no Worker
        
        const dayHistory = habits.map(habit => {
            const schedule = habit.scheduleHistory.find(s => s.startDate <= currentDateISO && (!s.endDate || s.endDate > currentDateISO));
            if (!schedule) return null;

            const instances = dayRecord[habit.id]?.instances || {};
            const statuses = schedule.times.map(time => {
                const status = instances[time]?.status;
                if (status === 'completed') return '✅';
                if (status === 'snoozed') return '➡️';
                return '⚪️';
            });
            return statuses.join('');
        }).filter(Boolean).join(' | ');

        if (dayHistory) {
            history += `${currentDateISO}: ${dayHistory}\n`;
        }
        date.setUTCDate(date.getUTCDate() - 1);
    }

    return history || translations['aiPromptNoData'];
}


async function buildAIPrompt(payload: AIPromptPayload) {
    const { analysisType, habits, dailyData, archives, languageName, translations, todayISO } = payload;
    
    const promptTemplate = translations.promptTemplate;

    const activeHabits = habits.filter(h => {
        const lastSchedule = h.scheduleHistory[h.scheduleHistory.length - 1];
        return !h.graduatedOn && !lastSchedule.endDate;
    });

    const graduatedHabits = habits.filter(h => h.graduatedOn);

    const getHabitListString = (habitList: Habit[]) => {
        return habitList.length > 0 ? habitList.map(h => getHabitDisplayInfo(h, translations, todayISO).name).join(', ') : translations['aiPromptNone'];
    };

    const activeHabitList = getHabitListString(activeHabits);
    const graduatedHabitList = getHabitListString(graduatedHabits);

    let graduatedHabitsSection = '';
    if (graduatedHabits.length > 0) {
        graduatedHabitsSection = translations['aiPromptGraduatedSection'].replace('{graduatedHabitList}', graduatedHabitList);
    }
    
    let daysToAnalyze = 30;
    if (analysisType === 'quarterly') daysToAnalyze = 90;
    if (analysisType === 'historical') {
        const firstHabitDate = habits.reduce((oldest, h) => {
            const created = h.createdOn;
            return created < oldest ? created : oldest;
        }, todayISO);
        const diffTime = Math.abs(parseUTCIsoDate(todayISO).getTime() - parseUTCIsoDate(firstHabitDate).getTime());
        daysToAnalyze = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    }
    
    // Agora assíncrono para suportar descompressão
    const history = await _getHistoryForPrompt(daysToAnalyze, activeHabits, dailyData, archives, todayISO, translations);

    const prompt = promptTemplate
        .replace('{activeHabitList}', activeHabitList)
        .replace('{graduatedHabitsSection}', graduatedHabitsSection)
        .replace('{history}', history);

    const systemInstruction = translations['aiSystemInstruction'].replace('{languageName}', languageName);
    
    return { prompt, systemInstruction };
}

// --- ARCHIVAL LOGIC [2025-03-22] ---

type ArchiveInputPayload = {
    // Mapa: Ano -> Objeto de Configuração
    [year: string]: {
        base?: string | Record<string, any>; // Pode ser string GZIP ou Objeto cru (se vindo do cache)
        additions: Record<string, Record<string, HabitDailyInfo>>; // Novos itens para arquivar
    }
};

type ArchiveOutputPayload = {
    // Mapa: Ano -> String GZIP final
    [year: string]: string;
};

async function processArchival(payload: ArchiveInputPayload): Promise<ArchiveOutputPayload> {
    const result: ArchiveOutputPayload = {};

    for (const year of Object.keys(payload)) {
        const { base, additions } = payload[year];
        let yearData: Record<string, any> = {};

        // 1. Hydrate Base
        if (base) {
            if (typeof base === 'string') {
                try {
                    if (base.startsWith('GZIP:')) {
                        const json = await decompressString(base.substring(5));
                        yearData = JSON.parse(json);
                    } else {
                        // Legacy JSON
                        yearData = JSON.parse(base);
                    }
                } catch (e) {
                    console.error(`Worker: Failed to parse base archive for year ${year}`, e);
                    // Fallback: Start fresh with additions to preserve new data
                }
            } else {
                // Object passed directly (from unarchivedCache)
                yearData = base;
            }
        }

        // 2. Merge Additions
        // Simple spread works because keys are dates (unique per day)
        // If a day exists in both (rare conflict), additions (from dailyData) should win as they are newer.
        yearData = { ...yearData, ...additions };

        // 3. Serialize & Compress
        try {
            const jsonString = JSON.stringify(yearData);
            const compressedBase64 = await compressString(jsonString);
            result[year] = `GZIP:${compressedBase64}`;
        } catch (e) {
            console.error(`Worker: Failed to compress archive for year ${year}`, e);
            // Se falhar compressão, tenta retornar o JSON cru como fallback para não perder dados
            result[year] = JSON.stringify(yearData); 
        }
    }

    return result;
}

// --- Worker Message Handler ---

type WorkerRequest = 
    | { id: string; type: 'encrypt'; payload: any; key: string }
    | { id: string; type: 'decrypt'; payload: string; key: string }
    | { id: string; type: 'build-ai-prompt'; payload: AIPromptPayload }
    | { id: string; type: 'archive'; payload: ArchiveInputPayload };

type WorkerResponse = 
    | { id: string; status: 'success'; result: any }
    | { id: string; status: 'error'; error: string };

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const { id, type, payload } = e.data;

    try {
        let result;

        if (type === 'encrypt') {
            const jsonString = JSON.stringify(payload);
            result = await encrypt(jsonString, (e.data as any).key);
        } else if (type === 'decrypt') {
            const jsonString = await decrypt(payload as string, (e.data as any).key);
            result = JSON.parse(jsonString);
        } else if (type === 'build-ai-prompt') {
            result = await buildAIPrompt(payload as AIPromptPayload);
        } else if (type === 'archive') {
            result = await processArchival(payload as ArchiveInputPayload);
        }
        else {
            throw new Error(`Unknown operation type: ${(e.data as any).type}`);
        }

        const response: WorkerResponse = { id, status: 'success', result };
        self.postMessage(response);

    } catch (error: any) {
        console.error(`Worker error during ${type}:`, error);
        const response: WorkerResponse = { 
            id, 
            status: 'error', 
            error: error.message || 'Unknown worker error' 
        };
        self.postMessage(response);
    }
};
