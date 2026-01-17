
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render.ts
 * @description Orquestrador de Renderização (View Orchestrator / Facade).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo atua como o ponto central de despacho para atualizações visuais.
 * 
 * ARQUITETURA (Facade Pattern):
 * - Centraliza a API de renderização pública, escondendo a complexidade dos sub-módulos (`render/*`).
 * - Implementa estratégias de "Local Dirty Checking" para componentes globais.
 * - REFACTOR [2025-03-22]: Agora ouve o evento `language-changed` disparado por `i18n.ts` em vez de gerenciar a lógica de tradução.
 */

import { state, LANGUAGES } from './state';
import { parseUTCIsoDate, toUTCIsoDateString, addDays, getDateTimeFormat, pushToOneSignal, getTodayUTCIso } from './utils';
import { ui } from './render/ui';
// FIX: import setLanguage here only for initI18n, but use the event for reactivity.
import { t, loadLanguage, setLanguage } from './i18n'; 
import { UI_ICONS } from './render/icons';
import type { Quote } from './data/quotes';

// Importa os renderizadores especializados
import { setTextContent, updateReelRotaryARIA } from './render/dom';
import { renderCalendar, renderFullCalendar } from './render/calendar';
import { renderHabits } from './render/habits';
import { renderChart } from './render/chart';
// Importação necessária para atualizar modais ao trocar idioma
import { setupManageModal, refreshEditModalUI, renderLanguageFilter, renderIconPicker, renderFrequencyOptions } from './render/modals';

// Re-exporta tudo para manter compatibilidade com listeners.ts e habitActions.ts
export * from './render/dom';
export * from './render/calendar';
export * from './render/habits';
export * from './render/modals';
export * from './render/chart';

// --- HELPERS ---

let _lastTitleDate: string | null = null;
let _lastTitleLang: string | null = null;
let _lastQuoteDate: string | null = null;
let _lastQuoteLang: string | null = null;
let stoicQuotesModule: { STOIC_QUOTES: Quote[] } | null = null;


function _updateHeaderTitle() {
    if (_lastTitleDate === state.selectedDate && _lastTitleLang === state.activeLanguageCode) {
        return;
    }

    const todayISO = getTodayUTCIso();
    const yesterdayISO = toUTCIsoDateString(addDays(parseUTCIsoDate(todayISO), -1));
    const tomorrowISO = toUTCIsoDateString(addDays(parseUTCIsoDate(todayISO), 1));

    const specialDateMap: Record<string, string> = {
        [todayISO]: 'headerTitleToday',
        [yesterdayISO]: 'headerTitleYesterday',
        [tomorrowISO]: 'headerTitleTomorrow',
    };

    let desktopTitle: string;
    let mobileTitle: string;
    
    const date = parseUTCIsoDate(state.selectedDate);
    
    const specialDateKey = specialDateMap[state.selectedDate];

    if (specialDateKey) {
        const title = t(specialDateKey);
        desktopTitle = title;
        mobileTitle = title;
    } else {
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        mobileTitle = `${day}/${month}`;
        
        desktopTitle = getDateTimeFormat(state.activeLanguageCode, {
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        }).format(date);
    }
    
    setTextContent(ui.headerTitleDesktop, desktopTitle);
    setTextContent(ui.headerTitleMobile, mobileTitle);
    
    const fullLabel = getDateTimeFormat(state.activeLanguageCode, {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC'
    }).format(date);
    ui.headerTitle.setAttribute('aria-label', fullLabel);

    _lastTitleDate = state.selectedDate;
    _lastTitleLang = state.activeLanguageCode;
}

function _renderHeaderIcons() {
    if (!ui.manageHabitsBtn.innerHTML) {
        ui.manageHabitsBtn.innerHTML = UI_ICONS.settings;
    }
    const aiDefaultIcon = ui.aiEvalBtn.querySelector('.default-icon');
    if (aiDefaultIcon && !aiDefaultIcon.innerHTML) {
        aiDefaultIcon.innerHTML = UI_ICONS.ai;
    }
}

/**
 * Atualiza todos os textos estáticos da UI.
 */
export function updateUIText() {
    const appNameHtml = t('appName');
    const tempEl = document.createElement('div');
    tempEl.innerHTML = appNameHtml;
    document.title = tempEl.textContent || 'Askesis';

    ui.fabAddHabit.setAttribute('aria-label', t('fabAddHabit_ariaLabel'));
    ui.manageHabitsBtn.setAttribute('aria-label', t('manageHabits_ariaLabel'));
    ui.aiEvalBtn.setAttribute('aria-label', t('aiEval_ariaLabel'));
    
    ui.exploreModal.querySelector('h2')!.textContent = t('modalExploreTitle');
    ui.createCustomHabitBtn.textContent = t('modalExploreCreateCustom');
    ui.exploreModal.querySelector('.modal-close-btn')!.textContent = t('closeButton');

    ui.manageModalTitle.textContent = t('modalManageTitle');
    ui.habitListTitle.textContent = t('modalManageHabitsSubtitle');
    
    ui.labelLanguage.textContent = t('modalManageLanguage');
    ui.languagePrevBtn.setAttribute('aria-label', t('languagePrev_ariaLabel'));
    ui.languageNextBtn.setAttribute('aria-label', t('languageNext_ariaLabel'));
    
    ui.labelSync.textContent = t('syncLabel');
    ui.labelNotifications.textContent = t('modalManageNotifications');
    ui.labelReset.textContent = t('modalManageReset');
    ui.resetAppBtn.textContent = t('modalManageResetButton');
    ui.manageModal.querySelector('.modal-close-btn')!.textContent = t('closeButton');
    
    ui.labelPrivacy.textContent = t('privacyLabel');
    ui.exportDataBtn.textContent = t('exportButton');
    ui.importDataBtn.textContent = t('importButton');
    
    ui.syncInactiveDesc.textContent = t('syncInactiveDesc');
    ui.enableSyncBtn.textContent = t('syncEnable');
    ui.enterKeyViewBtn.textContent = t('syncEnterKey');
    ui.labelEnterKey.textContent = t('syncLabelEnterKey');
    ui.cancelEnterKeyBtn.textContent = t('cancelButton');
    ui.submitKeyBtn.textContent = t('syncSubmitKey');
    ui.syncWarningText.innerHTML = t('syncWarning');

    const keyContext = ui.syncDisplayKeyView.dataset.context;
    ui.keySavedBtn.textContent = (keyContext === 'view') ? t('closeButton') : t('syncKeySaved');
    
    ui.syncActiveDesc.textContent = t('syncActiveDesc');
    ui.viewKeyBtn.textContent = t('syncViewKey');
    ui.disableSyncBtn.textContent = t('syncDisable');
    
    ui.aiModal.querySelector('h2')!.textContent = t('modalAITitle');
    ui.aiModal.querySelector('.modal-close-btn')!.textContent = t('closeButton');
    
    ui.aiOptionsModal.querySelector('h2')!.textContent = t('modalAIOptionsTitle');
    
    const updateAiBtn = (type: string, titleKey: string, descKey: string) => {
        const btn = ui.aiOptionsModal.querySelector<HTMLElement>(`[data-analysis-type="${type}"]`);
        if (btn) {
            btn.querySelector('.ai-option-title')!.textContent = t(titleKey);
            btn.querySelector('.ai-option-desc')!.textContent = t(descKey);
        }
    };
    updateAiBtn('monthly', 'aiOptionMonthlyTitle', 'aiOptionMonthlyDesc');
    updateAiBtn('quarterly', 'aiOptionQuarterlyTitle', 'aiOptionQuarterlyDesc');
    updateAiBtn('historical', 'aiOptionHistoricalTitle', 'aiOptionHistoricalDesc');

    ui.confirmModal.querySelector('h2')!.textContent = t('modalConfirmTitle');
    ui.confirmModal.querySelector('.modal-close-btn')!.textContent = t('cancelButton');
    ui.confirmModalEditBtn.textContent = t('editButton');
    ui.confirmModalConfirmBtn.textContent = t('confirmButton');

    ui.notesModal.querySelector('.modal-close-btn')!.textContent = t('cancelButton');
    ui.saveNoteBtn.textContent = t('modalNotesSaveButton');
    ui.notesTextarea.placeholder = t('modalNotesTextareaPlaceholder');

    ui.iconPickerTitle.textContent = t('modalIconPickerTitle');
    ui.iconPickerModal.querySelector('.modal-close-btn')!.textContent = t('cancelButton');

    ui.colorPickerTitle.textContent = t('modalColorPickerTitle');
    ui.colorPickerModal.querySelector('.modal-close-btn')!.textContent = t('cancelButton');

    const editModalActions = ui.editHabitModal.querySelector('.modal-actions');
    if (editModalActions) {
        editModalActions.querySelector('.modal-close-btn')!.textContent = t('cancelButton');
        editModalActions.querySelector('#edit-habit-save-btn')!.textContent = t('modalEditSaveButton');
    }

    ui.quickActionDone.innerHTML = `${UI_ICONS.check} ${t('quickActionMarkAllDone')}`;
    ui.quickActionSnooze.innerHTML = `${UI_ICONS.snoozed} ${t('quickActionMarkAllSnoozed')}`;
    ui.quickActionAlmanac.innerHTML = `${UI_ICONS.calendar} ${t('quickActionOpenAlmanac')}`;
    
    setTextContent(ui.noHabitsMessage, t('modalManageNoHabits'));

    if (state.editingHabit) {
        refreshEditModalUI();
    }
}

// --- ORQUESTRAÇÃO GLOBAL ---

export function renderApp() {
    _renderHeaderIcons();
    _updateHeaderTitle();
    renderStoicQuote();
    renderCalendar();
    renderHabits();
    renderAINotificationState();
    renderChart();

    // UX UPDATE [2025-03-22]: Refresh Manage Modal List if visible.
    // Garante que se o usuário encerrar ou excluir um hábito, a lista
    // seja atualizada imediatamente sem precisar fechar e reabrir o modal.
    if (ui.manageModal.classList.contains('visible')) {
        setupManageModal();
    }
}

export function updateNotificationUI() {
    const isPendingChange = ui.notificationToggle.disabled && !ui.notificationToggleLabel.classList.contains('disabled');
    if (isPendingChange) {
        setTextContent(ui.notificationStatusDesc, t('notificationChangePending'));
        return;
    }

    pushToOneSignal((OneSignal: any) => {
        const isPushEnabled = OneSignal.User.PushSubscription.optedIn;
        const permission = OneSignal.Notifications.permission;
        
        ui.notificationToggle.checked = isPushEnabled;
        const isDenied = permission === 'denied';
        ui.notificationToggle.disabled = isDenied;
        ui.notificationToggleLabel.classList.toggle('disabled', isDenied);

        let statusTextKey = 'notificationStatusOptedOut';
        if (isDenied) statusTextKey = 'notificationStatusDisabled';
        else if (isPushEnabled) statusTextKey = 'notificationStatusEnabled';
        
        setTextContent(ui.notificationStatusDesc, t(statusTextKey));
    });
}

export function initLanguageFilter() {
    const langNames = LANGUAGES.map(lang => t(lang.nameKey));
    ui.languageReel.innerHTML = langNames.map(name => `<span class="reel-option">${name}</span>`).join('');
    const currentIndex = LANGUAGES.findIndex(l => l.code === state.activeLanguageCode);
    updateReelRotaryARIA(ui.languageViewport, currentIndex, langNames, 'language_ariaLabel');
}

export function renderAINotificationState() {
    const isLoading = state.aiState === 'loading';
    const isOffline = !navigator.onLine;
    const hasCelebrations = state.pending21DayHabitIds.length > 0 || state.pendingConsolidationHabitIds.length > 0;
    const hasUnseenResult = (state.aiState === 'completed' || state.aiState === 'error') && !state.hasSeenAIResult;

    ui.aiEvalBtn.classList.toggle('loading', isLoading);
    ui.aiEvalBtn.disabled = isLoading || isOffline;
    ui.aiEvalBtn.classList.toggle('has-notification', hasCelebrations || hasUnseenResult);
}

export async function renderStoicQuote() {
    if (_lastQuoteDate === state.selectedDate && _lastQuoteLang === state.activeLanguageCode) {
        return;
    }

    if (!stoicQuotesModule) {
        try {
            stoicQuotesModule = await import('./data/quotes');
        } catch (e) {
            console.error("Failed to load stoic quotes module", e);
            return;
        }
    }
    const { STOIC_QUOTES } = stoicQuotesModule;

    const date = parseUTCIsoDate(state.selectedDate);
    const startOfYear = new Date(date.getUTCFullYear(), 0, 0);
    const diff = date.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    
    const seed = date.getFullYear() * 1000 + dayOfYear;
    const rnd = Math.abs(Math.sin(seed)); 
    const quoteIndex = Math.floor(rnd * STOIC_QUOTES.length);
    
    const quote = STOIC_QUOTES[quoteIndex];
    const lang = state.activeLanguageCode as keyof Omit<typeof quote, 'author'|'tags'>;
    const quoteText = quote[lang];
    const authorName = t(quote.author);
    const fullText = `"${quoteText}" — ${authorName}`;

    _lastQuoteDate = state.selectedDate;
    _lastQuoteLang = state.activeLanguageCode;

    if (ui.stoicQuoteDisplay.textContent === fullText && ui.stoicQuoteDisplay.classList.contains('visible')) {
        return;
    }

    if (ui.stoicQuoteDisplay.textContent === '') {
         setTextContent(ui.stoicQuoteDisplay, fullText);
         ui.stoicQuoteDisplay.classList.add('visible');
         return;
    }

    ui.stoicQuoteDisplay.classList.remove('visible');
    setTimeout(() => {
        setTextContent(ui.stoicQuoteDisplay, fullText);
        ui.stoicQuoteDisplay.classList.add('visible');
    }, 150);
}

// SETUP: Listen for language changes dispatched from i18n module
document.addEventListener('language-changed', () => {
    initLanguageFilter();
    renderLanguageFilter();
    updateUIText();
    if (ui.syncStatus) {
        ui.syncStatus.textContent = t(state.syncState);
    }
    if (ui.manageModal.classList.contains('visible')) {
        setupManageModal();
        updateNotificationUI();
    }
    renderApp();
});

export async function initI18n() {
    let savedLang: string | null = null;
    try {
        savedLang = localStorage.getItem('habitTrackerLanguage');
    } catch (e) {
        console.warn("Language storage access blocked:", e);
    }

    const browserLang = navigator.language.split('-')[0];
    let initialLang: 'pt' | 'en' | 'es' = 'pt';

    if (savedLang && ['pt', 'en', 'es'].includes(savedLang)) {
        initialLang = savedLang as 'pt' | 'en' | 'es';
    } else if (['pt', 'en', 'es'].includes(browserLang)) {
        initialLang = browserLang as 'pt' | 'en' | 'es';
    }

    // This calls setLanguage in i18n.ts, which dispatches the event that triggers the listener above.
    await setLanguage(initialLang);
}
