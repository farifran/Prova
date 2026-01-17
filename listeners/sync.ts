
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/sync.ts
 * @description Controlador de Interface para Sincronização e Autenticação (Sync UI Controller).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia a Máquina de Estados da UI de Sincronização (Views: Inactive, Entry, Active).
 * 
 * ARQUITETURA:
 * - State Machine Pattern: A UI alterna entre estados discretos (`showView`) em vez de manipular
 *   visibilidade de elementos individuais, prevenindo estados inconsistentes.
 * - Transactional Key Swap: Ao inserir uma chave, o sistema entra em um estado "tentativo".
 *   Se houver erro ou cancelamento, a chave anterior é restaurada (Rollback).
 * - Optimistic UI Locking: Botões são desabilitados (`_toggleButtons`) durante operações de rede
 *   para evitar submissões duplas ou condições de corrida.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `services/cloud.ts`: Orquestração de dados e criptografia.
 * - `services/api.ts`: Gerenciamento seguro de chaves no LocalStorage.
 */

import { ui } from "../render/ui";
import { t } from "../i18n";
import { fetchStateFromCloud, setSyncStatus, preloadWorker } from "../services/cloud";
// ARCHITECTURE FIX: Import persistence logic from service layer.
import { loadState, saveState } from "../services/persistence";
import { renderApp } from "../render";
// FIX [2025-03-22]: Import direct from module to avoid circular dependency issues with re-exports
import { showConfirmationModal } from "../render/modals";
import { storeKey, clearKey, hasLocalSyncKey, getSyncKey, isValidKeyFormat, initAuth } from "../services/api";

// --- Funções de UI ---

/**
 * View Controller: Gerencia a visibilidade das seções do painel de sincronização.
 * PERFORMANCE: Manipulação direta de estilo (display) é mais eficiente que classes para toggle simples.
 */
function showView(view: 'inactive' | 'enterKey' | 'displayKey' | 'active') {
    const viewsMap = {
        inactive: ui.syncInactiveView,
        enterKey: ui.syncEnterKeyView,
        displayKey: ui.syncDisplayKeyView,
        active: ui.syncActiveView,
    };

    // PERFORMANCE: Loop otimizado sobre chaves fixas.
    for (const key in viewsMap) {
        viewsMap[key as keyof typeof viewsMap].style.display = 'none';
    }

    viewsMap[view].style.display = 'flex';

    if (view === 'displayKey') {
        const context = ui.syncDisplayKeyView.dataset.context;
        ui.keySavedBtn.textContent = (context === 'view') ? t('closeButton') : t('syncKeySaved');
    }
}

/**
 * UX/SAFETY: Bloqueia a interface durante operações assíncronas.
 * Previne condições de corrida onde o usuário clica duas vezes antes da rede responder.
 */
function _toggleButtons(buttons: HTMLButtonElement[], disabled: boolean) {
    buttons.forEach(btn => btn.disabled = disabled);
}

// --- Lógica Principal ---

async function handleEnableSync() {
    const buttons = [ui.enableSyncBtn, ui.enterKeyViewBtn];
    _toggleButtons(buttons, true);

    try {
        // CRITICAL LOGIC: Setup Transacional.
        // 1. Gera chave -> 2. Armazena Otimisticamente -> 3. Tenta Sync Inicial.
        // Se o passo 3 falhar, o catch executa o Rollback (clearKey).
        const newKey = crypto.randomUUID();
        storeKey(newKey); // Armazena otimisticamente via api.ts
        ui.syncKeyText.textContent = newKey;
        ui.syncDisplayKeyView.dataset.context = 'setup';
        showView('displayKey');
        await fetchStateFromCloud(); // Aciona a sincronização inicial
    } catch (e) {
        console.error("Failed initial sync on new key generation", e);
        clearKey(); // Rollback: Reverte em caso de falha de rede/crypto
        showView('inactive');
        setSyncStatus('syncError');
    } finally {
        _toggleButtons(buttons, false);
    }
}

/**
 * CRITICAL LOGIC: Tentative Key Processing.
 * Esta função gerencia a troca de chaves. Ela deve lidar com segurança com:
 * 1. Chaves inválidas.
 * 2. Conflitos de dados (Cloud vs Local).
 * 3. Cancelamento pelo usuário.
 * 
 * DO NOT REFACTOR: A lógica de swap/restore (`originalKey`) é essencial para evitar perda de acesso.
 */
async function _processKey(key: string) {
    const buttons = [ui.submitKeyBtn, ui.cancelEnterKeyBtn];
    _toggleButtons(buttons, true);
    
    // UX: Feedback imediato de carregamento
    const originalBtnText = ui.submitKeyBtn.textContent;
    ui.submitKeyBtn.textContent = t('syncSaving'); 

    const originalKey = getSyncKey();
    
    try {
        // Usa temporariamente a nova chave para buscar na nuvem
        // Nota: fetchStateFromCloud usa getSyncKey internamente, então precisamos armazenar temporariamente
        storeKey(key);
        
        // PERFORMANCE: Network Request (Bloqueante para o fluxo, mas não para a thread pois é async)
        const cloudState = await fetchStateFromCloud();

        // Se houver conflito ou sucesso, mantemos a chave.
        // Mas para o fluxo de UI, se houver dados, perguntamos antes de sobrescrever.
        
        // SAFETY: Reverte temporariamente para a chave original enquanto o usuário decide no modal.
        // Isso evita que o app fique num estado "limbo" se o modal for fechado sem ação.
        if (originalKey) storeKey(originalKey); 
        else clearKey();

        if (cloudState) {
            showConfirmationModal(
                t('confirmSyncOverwrite'),
                async () => { // onConfirm
                    storeKey(key); // Commit: Persiste a nova chave definitivamente
                    await loadState(cloudState);
                    await saveState(); // Garante persistência assíncrona no IDB
                    renderApp();
                    showView('active');
                },
                {
                    title: t('syncDataFoundTitle'),
                    confirmText: t('syncConfirmOverwrite'),
                    cancelText: t('cancelButton')
                }
            );
        } else {
            // Nenhum estado na nuvem, assumimos que é uma chave nova válida ou vazia.
            storeKey(key);
            showView('active');
        }
    } catch (error) {
        // Rollback em caso de erro fatal
        if (originalKey) storeKey(originalKey);
        else clearKey();

        console.error("Failed to sync with provided key:", error);
        setSyncStatus('syncError');
    } finally {
        // [2025-01-15] BUGFIX: Reabilitar botões incondicionalmente.
        // Anteriormente, havia uma verificação se o modal estava visível.
        // Como o overlay do modal já impede cliques na interface de fundo, é seguro reabilitar aqui.
        ui.submitKeyBtn.textContent = originalBtnText;
        _toggleButtons(buttons, false);
    }
}

function handleSubmitKey() {
    const key = ui.syncKeyInput.value.trim();
    if (!key) return;

    // INPUT VALIDATION: Previne chamadas de API desnecessárias para chaves malformadas.
    if (!isValidKeyFormat(key)) {
        showConfirmationModal(
            t('confirmInvalidKeyBody'),
            () => _processKey(key),
            {
                title: t('confirmInvalidKeyTitle'),
                confirmText: t('confirmButton'),
                cancelText: t('cancelButton')
            }
        );
    } else {
        _processKey(key);
    }
}

function handleDisableSync() {
    console.log("Requesting sync disable...");
    
    // Ensure the modal helper is available
    if (typeof showConfirmationModal !== 'function') {
        console.error("Critical Error: showConfirmationModal is not defined. Circular dependency likely.");
        return;
    }

    showConfirmationModal(
        t('confirmSyncDisable'),
        () => {
            clearKey();
            setSyncStatus('syncInitial');
            showView('inactive');
        },
        { 
            title: t('syncDisableTitle'), 
            confirmText: t('syncDisableConfirm'),
            confirmButtonStyle: 'danger'
        }
    );
}

function handleViewKey() {
    const key = getSyncKey();
    if (key) {
        ui.syncKeyText.textContent = key;
        ui.syncDisplayKeyView.dataset.context = 'view';
        showView('displayKey');
    }
}

function handleCopyKey() {
    const key = ui.syncKeyText.textContent;
    if(key) {
        // [2025-01-15] ROBUSTNESS: Adicionado tratamento de erro para a API Clipboard.
        // A API clipboard é assíncrona e pode falhar (ex: permissões, contexto não seguro).
        navigator.clipboard.writeText(key).then(() => {
            const originalText = ui.copyKeyBtn.innerHTML;
            ui.copyKeyBtn.innerHTML = '✓';
            setTimeout(() => { ui.copyKeyBtn.innerHTML = originalText; }, 1500);
        }).catch(err => {
            console.error("Failed to copy key to clipboard:", err);
        });
    }
}

export async function initSync() {
    // Inicializa o armazenamento de chaves via API module
    initAuth();
    const hasKey = hasLocalSyncKey();

    if (hasKey) {
        showView('active');
        setSyncStatus('syncSynced');
    } else {
        showView('inactive');
        setSyncStatus('syncInitial');
    }
    
    // SETUP LISTENERS: Anexa eventos apenas uma vez na inicialização.
    ui.enableSyncBtn.addEventListener('click', handleEnableSync);
    ui.enterKeyViewBtn.addEventListener('click', () => {
        // PERCEIVED PERFORMANCE: Pre-warm the worker thread immediately.
        // Iniciar o worker agora remove a latência de boot (~50-100ms) quando o usuário clicar em Submit.
        preloadWorker();
        showView('enterKey');
    });
    ui.cancelEnterKeyBtn.addEventListener('click', () => {
        ui.syncKeyInput.value = '';
        showView('inactive');
    });
    ui.submitKeyBtn.addEventListener('click', handleSubmitKey);
    ui.keySavedBtn.addEventListener('click', () => showView('active'));
    ui.copyKeyBtn.addEventListener('click', handleCopyKey);
    ui.viewKeyBtn.addEventListener('click', handleViewKey);
    ui.disableSyncBtn.addEventListener('click', handleDisableSync);
}
