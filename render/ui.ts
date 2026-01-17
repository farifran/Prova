
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/ui.ts
 * @description Registro Central de Elementos do DOM (UI Registry / DOM Facade).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este arquivo atua como a única fonte de verdade para referências a elementos HTML.
 * 
 * ARQUITETURA (Lazy DOM Access & Memoization):
 * - **Responsabilidade Única:** Mapear seletores CSS para propriedades tipadas do TypeScript.
 * - **Lazy Loading:** Nenhum elemento é consultado (`querySelector`) na inicialização do módulo.
 *   As consultas ocorrem apenas no primeiro acesso à propriedade (`ui.meuElemento`).
 *   Isso reduz drasticamente o tempo de bloqueio da thread principal (TTI - Time to Interactive) durante o boot.
 * - **Memoization:** Após o primeiro acesso, a referência é cacheada em memória (`uiCache`).
 *   Acessos subsequentes são O(1).
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `index.html`: Os seletores aqui definidos DEVEM existir no HTML. Se um ID mudar no HTML,
 *   este arquivo deve ser atualizado ou a aplicação quebrará em runtime.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Hybrid Query Strategy:** Detecta seletores simples de ID (`#id`) para usar `getElementById` (muito mais rápido)
 *    em vez de `querySelector` (que exige parsing de CSS).
 * 2. **Typed Interfaces:** Garante que o TypeScript saiba exatamente qual tipo de elemento é esperado (HTMLButtonElement, etc),
 *    evitando casts repetitivos no código da aplicação.
 */

type UIElements = {
    appContainer: HTMLElement; // Cached reference
    calendarStrip: HTMLElement;
    headerTitle: HTMLElement;
    headerTitleDesktop: HTMLElement;
    headerTitleMobile: HTMLElement;
    stoicQuoteDisplay: HTMLElement;
    habitContainer: HTMLElement;
    chartContainer: HTMLElement;
    manageHabitsBtn: HTMLButtonElement;
    fabAddHabit: HTMLButtonElement;
    manageModal: HTMLElement;
    manageModalTitle: HTMLElement;
    habitListTitle: HTMLElement;
    exploreModal: HTMLElement;
    exploreHabitList: HTMLElement;
    createCustomHabitBtn: HTMLButtonElement;
    aiEvalBtn: HTMLButtonElement;
    aiModal: HTMLElement;
    aiOptionsModal: HTMLElement;
    confirmModal: HTMLElement;
    habitList: HTMLElement;
    noHabitsMessage: HTMLElement;
    aiResponse: HTMLElement;
    confirmModalText: HTMLElement;
    confirmModalConfirmBtn: HTMLButtonElement;
    confirmModalEditBtn: HTMLButtonElement;
    notesModal: HTMLElement;
    notesModalTitle: HTMLElement;
    notesModalSubtitle: HTMLElement;
    notesTextarea: HTMLTextAreaElement;
    saveNoteBtn: HTMLButtonElement;
    resetAppBtn: HTMLButtonElement;
    languagePrevBtn: HTMLButtonElement;
    languageViewport: HTMLElement;
    languageReel: HTMLElement;
    languageNextBtn: HTMLButtonElement;
    editHabitModal: HTMLElement;
    editHabitModalTitle: HTMLElement;
    editHabitForm: HTMLFormElement;
    editHabitSaveBtn: HTMLButtonElement;
    habitTimeContainer: HTMLElement;
    frequencyOptionsContainer: HTMLElement;
    syncStatus: HTMLElement;
    syncSection: HTMLElement;
    syncInactiveView: HTMLElement;
    enableSyncBtn: HTMLButtonElement;
    enterKeyViewBtn: HTMLButtonElement;
    syncEnterKeyView: HTMLElement;
    syncKeyInput: HTMLInputElement;
    cancelEnterKeyBtn: HTMLButtonElement;
    submitKeyBtn: HTMLButtonElement;
    syncDisplayKeyView: HTMLElement;
    syncKeyText: HTMLElement;
    copyKeyBtn: HTMLButtonElement;
    keySavedBtn: HTMLButtonElement;
    syncActiveView: HTMLElement;
    viewKeyBtn: HTMLButtonElement;
    disableSyncBtn: HTMLButtonElement;
    notificationToggle: HTMLInputElement;
    notificationToggleLabel: HTMLLabelElement;
    notificationStatusDesc: HTMLElement;
    iconPickerModal: HTMLElement;
    iconPickerGrid: HTMLElement;
    habitIconPickerBtn: HTMLButtonElement;
    colorPickerModal: HTMLElement;
    colorPickerGrid: HTMLElement;
    changeColorFromPickerBtn: HTMLButtonElement;
    fullCalendarModal: HTMLElement;
    fullCalendarHeader: HTMLElement;
    fullCalendarMonthYear: HTMLElement;
    fullCalendarPrevBtn: HTMLButtonElement;
    fullCalendarNextBtn: HTMLButtonElement;
    fullCalendarWeekdays: HTMLElement;
    fullCalendarGrid: HTMLElement;
    calendarQuickActions: HTMLElement;
    quickActionDone: HTMLButtonElement;
    quickActionSnooze: HTMLButtonElement;
    quickActionAlmanac: HTMLButtonElement;
    
    // Static Text Elements (Labels/Titles) for i18n
    labelLanguage: HTMLElement;
    labelSync: HTMLElement;
    labelNotifications: HTMLElement;
    labelReset: HTMLElement;
    labelPrivacy: HTMLElement;
    exportDataBtn: HTMLButtonElement;
    importDataBtn: HTMLButtonElement;
    syncInactiveDesc: HTMLElement;
    labelEnterKey: HTMLElement;
    syncWarningText: HTMLElement;
    syncActiveDesc: HTMLElement;
    iconPickerTitle: HTMLElement;
    colorPickerTitle: HTMLElement;

    // Chart Elements
    chart: {
        title: HTMLElement;
        subtitle: HTMLElement;
        emptyState: HTMLElement;
        dataView: HTMLElement;
        wrapper: HTMLElement;
        svg: SVGSVGElement;
        areaPath: SVGPathElement;
        linePath: SVGPathElement;
        tooltip: HTMLElement;
        tooltipDate: HTMLElement;
        tooltipScoreLabel: HTMLElement;
        tooltipScoreValue: HTMLElement;
        tooltipHabits: HTMLElement;
        indicator: HTMLElement;
        evolutionIndicator: HTMLElement;
        axisStart: HTMLElement;
        axisEnd: HTMLElement;
    }
};

// MEMORY: Objetos de cache simples para armazenar referências DOM resolvidas.
const uiCache: Partial<UIElements> = {};
const chartCache: Partial<UIElements['chart']> = {};

/**
 * Utilitário de consulta DOM otimizado.
 * @param selector String seletora CSS.
 */
function queryElement<T extends Element = HTMLElement>(selector: string): T {
    // PERFORMANCE OPTIMIZATION [2025-03-16]: Hybrid Selector Strategy.
    // 'getElementById' é essencialmente uma busca em hash map (O(1)) no navegador,
    // significativamente mais rápida que 'querySelector' que requer parsing de seletor CSS e travessia de árvore.
    // Detectamos seletores de ID simples para usar o caminho rápido (Fast Path).
    const isSimpleId = selector.startsWith('#') && !selector.includes(' ') && !selector.includes('.') && !selector.includes('[');
    
    const element = isSimpleId
        ? document.getElementById(selector.substring(1)) as unknown as T
        : document.querySelector<T>(selector);

    if (!element) {
        // FAIL FAST: É melhor quebrar explicitamente aqui do que ter 'undefined' flutuando na aplicação.
        throw new Error(`UI element with selector "${selector}" not found in the DOM.`);
    }
    return element;
}

/**
 * CRITICAL LOGIC: Factory de Getters Lazy.
 * Cria uma propriedade que, ao ser acessada pela primeira vez, consulta o DOM e cacheia o resultado.
 * DO NOT REFACTOR: Mudar para consulta "Eager" (imediata) degradará a performance de inicialização.
 */
function createLazyGetter<K extends keyof UIElements>(key: K, selector: string): Pick<UIElements, K> {
    return {
        get [key]() {
            if (!uiCache[key]) {
                (uiCache as any)[key] = queryElement(selector);
            }
            return uiCache[key] as UIElements[K];
        }
    } as Pick<UIElements, K>;
}

function createLazyChartGetter<K extends keyof UIElements['chart']>(key: K, selector: string): Pick<UIElements['chart'], K> {
    return {
        get [key]() {
            if (!chartCache[key]) {
                (chartCache as any)[key] = queryElement(selector);
            }
            return chartCache[key] as UIElements['chart'][K];
        }
    } as Pick<UIElements['chart'], K>;
}

/**
 * Singleton de Interface de Usuário.
 * Exporta um objeto proxy onde cada propriedade dispara a consulta DOM sob demanda.
 */
export const ui: UIElements = {
    ...createLazyGetter('appContainer', '.app-container'),
    ...createLazyGetter('calendarStrip', '#calendar-strip'),
    ...createLazyGetter('headerTitle', '#header-title'),
    ...createLazyGetter('headerTitleDesktop', '#header-title .header-title-desktop'),
    ...createLazyGetter('headerTitleMobile', '#header-title .header-title-mobile'),
    ...createLazyGetter('stoicQuoteDisplay', '#stoic-quote-display'),
    ...createLazyGetter('habitContainer', '#habit-container'),
    ...createLazyGetter('chartContainer', '#chart-container'),
    ...createLazyGetter('manageHabitsBtn', '#manage-habits-btn'),
    ...createLazyGetter('fabAddHabit', '#fab-add-habit'),
    ...createLazyGetter('manageModal', '#manage-modal'),
    ...createLazyGetter('manageModalTitle', '#manage-modal-title'),
    ...createLazyGetter('habitListTitle', '#habit-list-title'),
    ...createLazyGetter('exploreModal', '#explore-modal'),
    ...createLazyGetter('exploreHabitList', '#explore-habit-list'),
    ...createLazyGetter('createCustomHabitBtn', '#create-custom-habit-btn'),
    ...createLazyGetter('aiEvalBtn', '#ai-eval-btn'),
    ...createLazyGetter('aiModal', '#ai-modal'),
    ...createLazyGetter('aiOptionsModal', '#ai-options-modal'),
    ...createLazyGetter('confirmModal', '#confirm-modal'),
    ...createLazyGetter('habitList', '#habit-list'),
    ...createLazyGetter('noHabitsMessage', '#no-habits-message'),
    ...createLazyGetter('aiResponse', '#ai-response'),
    ...createLazyGetter('confirmModalText', '#confirm-modal-text'),
    ...createLazyGetter('confirmModalConfirmBtn', '#confirm-modal-confirm-btn'),
    ...createLazyGetter('confirmModalEditBtn', '#confirm-modal-edit-btn'),
    ...createLazyGetter('notesModal', '#notes-modal'),
    ...createLazyGetter('notesModalTitle', '#notes-modal-title'),
    ...createLazyGetter('notesModalSubtitle', '#notes-modal-subtitle'),
    ...createLazyGetter('notesTextarea', '#notes-textarea'),
    ...createLazyGetter('saveNoteBtn', '#save-note-btn'),
    ...createLazyGetter('resetAppBtn', '#reset-app-btn'),
    ...createLazyGetter('languagePrevBtn', '#language-prev'),
    ...createLazyGetter('languageViewport', '#language-viewport'),
    ...createLazyGetter('languageReel', '#language-reel'),
    ...createLazyGetter('languageNextBtn', '#language-next'),
    ...createLazyGetter('editHabitModal', '#edit-habit-modal'),
    ...createLazyGetter('editHabitModalTitle', '#edit-habit-modal-title'),
    ...createLazyGetter('editHabitForm', '#edit-habit-form'),
    ...createLazyGetter('editHabitSaveBtn', '#edit-habit-save-btn'),
    ...createLazyGetter('habitTimeContainer', '#habit-time-container'),
    ...createLazyGetter('frequencyOptionsContainer', '#frequency-options-container'),
    ...createLazyGetter('syncStatus', '#sync-status'),
    ...createLazyGetter('syncSection', '#sync-section'),
    ...createLazyGetter('syncInactiveView', '#sync-inactive-view'),
    ...createLazyGetter('enableSyncBtn', '#enable-sync-btn'),
    ...createLazyGetter('enterKeyViewBtn', '#enter-key-view-btn'),
    ...createLazyGetter('syncEnterKeyView', '#sync-enter-key-view'),
    ...createLazyGetter('syncKeyInput', '#sync-key-input'),
    ...createLazyGetter('cancelEnterKeyBtn', '#cancel-enter-key-btn'),
    ...createLazyGetter('submitKeyBtn', '#submit-key-btn'),
    ...createLazyGetter('syncDisplayKeyView', '#sync-display-key-view'),
    ...createLazyGetter('syncKeyText', '#sync-key-text'),
    ...createLazyGetter('copyKeyBtn', '#copy-key-btn'),
    ...createLazyGetter('keySavedBtn', '#key-saved-btn'),
    ...createLazyGetter('syncActiveView', '#sync-active-view'),
    ...createLazyGetter('viewKeyBtn', '#view-key-btn'),
    ...createLazyGetter('disableSyncBtn', '#disable-sync-btn'),
    ...createLazyGetter('notificationToggle', '#notification-toggle'),
    ...createLazyGetter('notificationToggleLabel', '#notification-toggle-label'),
    ...createLazyGetter('notificationStatusDesc', '#notification-status-desc'),
    ...createLazyGetter('iconPickerModal', '#icon-picker-modal'),
    ...createLazyGetter('iconPickerGrid', '#icon-picker-grid'),
    ...createLazyGetter('habitIconPickerBtn', '#habit-icon-picker-btn'),
    ...createLazyGetter('colorPickerModal', '#color-picker-modal'),
    ...createLazyGetter('colorPickerGrid', '#color-picker-grid'),
    ...createLazyGetter('changeColorFromPickerBtn', '#change-color-from-picker-btn'),
    ...createLazyGetter('fullCalendarModal', '#full-calendar-modal'),
    ...createLazyGetter('fullCalendarHeader', '#full-calendar-header'),
    ...createLazyGetter('fullCalendarMonthYear', '#full-calendar-month-year'),
    ...createLazyGetter('fullCalendarPrevBtn', '#full-calendar-prev'),
    ...createLazyGetter('fullCalendarNextBtn', '#full-calendar-next'),
    ...createLazyGetter('fullCalendarWeekdays', '#full-calendar-weekdays'),
    ...createLazyGetter('fullCalendarGrid', '#full-calendar-grid'),
    ...createLazyGetter('calendarQuickActions', '#calendar-quick-actions'),
    ...createLazyGetter('quickActionDone', '#quick-action-done'),
    ...createLazyGetter('quickActionSnooze', '#quick-action-snooze'),
    ...createLazyGetter('quickActionAlmanac', '#quick-action-almanac'),
    ...createLazyGetter('labelLanguage', '#label-language'),
    ...createLazyGetter('labelSync', '#label-sync'),
    ...createLazyGetter('labelNotifications', '#label-notifications'),
    ...createLazyGetter('labelReset', '#label-reset'),
    ...createLazyGetter('labelPrivacy', '#label-privacy'),
    ...createLazyGetter('exportDataBtn', '#export-data-btn'),
    ...createLazyGetter('importDataBtn', '#import-data-btn'),
    ...createLazyGetter('syncInactiveDesc', '#sync-inactive-desc'),
    ...createLazyGetter('labelEnterKey', '#label-enter-key'),
    ...createLazyGetter('syncWarningText', '#sync-warning-text'),
    ...createLazyGetter('syncActiveDesc', '#sync-active-desc'),
    ...createLazyGetter('iconPickerTitle', '#icon-picker-modal-title'),
    ...createLazyGetter('colorPickerTitle', '#color-picker-modal-title'),
    chart: {
        ...createLazyChartGetter('title', '#chart-container .chart-title'),
        ...createLazyChartGetter('subtitle', '#chart-container .app-subtitle'),
        ...createLazyChartGetter('emptyState', '#chart-container .chart-empty-state'),
        ...createLazyChartGetter('dataView', '#chart-container .chart-data-view'),
        ...createLazyChartGetter('wrapper', '#chart-container .chart-wrapper'),
        ...createLazyChartGetter('svg', '.chart-svg'),
        ...createLazyChartGetter('areaPath', '.chart-area'),
        ...createLazyChartGetter('linePath', '.chart-line'),
        ...createLazyChartGetter('tooltip', '#chart-container .chart-tooltip'),
        ...createLazyChartGetter('tooltipDate', '#chart-container .tooltip-date'),
        ...createLazyChartGetter('tooltipScoreLabel', '#chart-container .tooltip-score-label'),
        ...createLazyChartGetter('tooltipScoreValue', '#chart-container .tooltip-score-value'),
        ...createLazyChartGetter('tooltipHabits', '#chart-container .tooltip-habits li'),
        ...createLazyChartGetter('indicator', '#chart-container .chart-indicator'),
        ...createLazyChartGetter('evolutionIndicator', '#chart-container .chart-evolution-indicator'),
        ...createLazyChartGetter('axisStart', '#chart-container .chart-axis-labels span:first-child'),
        ...createLazyChartGetter('axisEnd', '#chart-container .chart-axis-labels span:last-child'),
    }
};
