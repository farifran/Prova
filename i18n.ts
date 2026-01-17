
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file i18n.ts
 * @description Motor de Internacionalização (i18n) e Formatação de Texto.
 * 
 * [MAIN THREAD CONTEXT]:
 * Executa na thread principal. A performance aqui é crítica pois `t()` é chamada centenas de vezes.
 * 
 * ARQUITETURA (Pure Logic Layer):
 * - REFACTOR [2025-03-22]: Este módulo agora é "puro". Ele não importa mais nada de `render/` 
 *   para evitar dependências circulares. A lógica de atualização de UI (efeito colateral) 
 *   foi movida para `render.ts`.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `state.ts`: Acesso ao idioma ativo.
 * - `locales/*.json`: Arquivos de tradução.
 */

import { state, Habit, PredefinedHabit, TimeOfDay } from './state';
import { getScheduleForDate } from './services/selectors';
import { getDateTimeFormat, pushToOneSignal } from './utils';

type PluralableTranslation = { one: string; other: string };
type TranslationValue = string | PluralableTranslation;
type Translations = Record<string, TranslationValue>;

// PERFORMANCE: Cache para instâncias de PluralRules para evitar recriação custosa a cada tradução.
const pluralRulesCache: Record<string, Intl.PluralRules> = {};

const loadedTranslations: Record<string, Translations> = {};

// Função agora exportada para ser usada pelo orquestrador em render.ts
export async function loadLanguage(langCode: 'pt' | 'en' | 'es'): Promise<void> {
    if (loadedTranslations[langCode]) {
        return;
    }
    try {
        const response = await fetch(`./locales/${langCode}.json`);
        if (!response.ok) {
            throw new Error(`Failed to load language file: ${response.statusText}`);
        }
        const translations = await response.json();
        loadedTranslations[langCode] = translations;
    } catch (error) {
        console.error(`Could not load translations for ${langCode}:`, error);
        if (langCode !== 'pt' && !loadedTranslations['pt']) {
            try {
                await loadLanguage('pt');
            } catch (fallbackError) {
                console.error(`CRITICAL: Could not load fallback language 'pt'. UI text will not be available.`, fallbackError);
            }
        }
    }
}

// PERFORMANCE: Pre-compiled Regex for interpolation.
const INTERPOLATION_REGEX = /{([^{}]+)}/g;

export function t(key: string, options?: { [key: string]: string | number | undefined }): string {
    const lang = state.activeLanguageCode || 'pt';
    const dict = loadedTranslations[lang] || loadedTranslations['pt'];

    if (!dict) {
        return key;
    }

    const translationValue = dict[key];

    if (translationValue === undefined) {
        return key;
    }

    let translationString: string;

    if (typeof translationValue === 'object') {
        if (options?.count !== undefined) {
            let pluralRules = pluralRulesCache[lang];
            if (!pluralRules) {
                pluralRules = new Intl.PluralRules(lang);
                pluralRulesCache[lang] = pluralRules;
            }
            
            const pluralKey = pluralRules.select(options.count as number);
            translationString = (translationValue as PluralableTranslation)[pluralKey as keyof PluralableTranslation] || (translationValue as PluralableTranslation).other;
        } else {
            return key;
        }
    } else {
        translationString = translationValue;
    }

    if (options) {
        return translationString.replace(INTERPOLATION_REGEX, (_match, key) => {
            const value = options[key];
            return value !== undefined ? String(value) : _match;
        });
    }

    return translationString;
}

export function getTimeOfDayName(time: TimeOfDay): string {
    return t(`filter${time}`);
}

export function getHabitDisplayInfo(habit: Habit | PredefinedHabit, dateISO?: string): { name: string, subtitle: string } {
    let source: any = habit;
    
    if ('scheduleHistory' in habit && habit.scheduleHistory.length > 0) {
        if (dateISO) {
            source = getScheduleForDate(habit, dateISO) || habit.scheduleHistory[habit.scheduleHistory.length - 1];
        } else {
            source = habit.scheduleHistory[habit.scheduleHistory.length - 1];
        }
    }

    if (source.nameKey) {
        return {
            name: t(source.nameKey),
            subtitle: source.subtitleKey ? t(source.subtitleKey) : ''
        };
    }
    return {
        name: source.name || '',
        subtitle: source.subtitleKey ? t(source.subtitleKey) : (source.subtitle || '')
    };
}

export function getLocaleDayName(date: Date): string {
    return getDateTimeFormat(state.activeLanguageCode, { weekday: 'short', timeZone: 'UTC' }).format(date).toUpperCase();
}

/**
 * Define o idioma ativo e dispara o evento 'language-changed'.
 * Isso desacopla a lógica de tradução da atualização de UI (evitando ciclos).
 */
export async function setLanguage(langCode: 'pt' | 'en' | 'es') {
    await loadLanguage(langCode);
    
    state.activeLanguageCode = langCode;
    document.documentElement.lang = langCode;
    
    try {
        localStorage.setItem('habitTrackerLanguage', langCode);
    } catch (e) {
        console.warn("Language preference could not be saved to storage:", e);
    }
    
    pushToOneSignal((OneSignal: any) => {
        OneSignal.User.setLanguage(langCode);
    });

    // Dirty Checking flags
    state.uiDirtyState.calendarVisuals = true;
    state.uiDirtyState.habitListStructure = true;
    state.uiDirtyState.chartData = true;

    // EVENT BUS PATTERN: Notifica o sistema que o idioma mudou.
    // O módulo `render.ts` ouvirá isso e atualizará a UI.
    document.dispatchEvent(new CustomEvent('language-changed'));
}
