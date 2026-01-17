
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file cloud.ts
 * @description Orquestrador de Sincronização e Ponte para Web Workers (Main Thread Client).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo roda na thread principal (UI), mas sua função primária é **delegar** processamento pesado.
 * Atua como o "Cliente" para o `sync.worker.ts` e gerencia a máquina de estados da sincronização.
 * 
 * ARQUITETURA (Worker Bridge & Mutex):
 * - **Responsabilidade Única:** Gerenciar o ciclo de vida da sincronização (Rede + Criptografia) e comunicação com Workers.
 * - **Off-Main-Thread Architecture:** Garante que Criptografia (AES-GCM), Parsing de JSON massivo e 
 *   construção de prompts de IA ocorram em uma thread separada para manter a UI em 60fps (Zero Jank).
 * - **Controle de Concorrência:** Implementa um Mutex lógico (`isSyncInProgress`) e Debouncing 
 *   para evitar condições de corrida em rede e sobrecarga de bateria.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `sync.worker.ts`: O script do worker (deve coincidir com a saída do build).
 * - `services/dataMerge.ts`: Algoritmo de resolução de conflitos (Smart Merge).
 * - `services/api.ts`: Transporte HTTP.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Lazy Worker Instantiation:** O Worker consome memória significativa. Só é criado quando necessário.
 * 2. **Promise-based Messaging:** Abstrai a complexidade de `postMessage` em chamadas `async/await` lineares.
 * 3. **Recursive Queueing:** Se o estado muda durante uma sincronização, uma nova sincronização é agendada automaticamente.
 */

import { AppState, state, getPersistableState } from '../state';
import { loadState, persistStateLocally } from './persistence';
import { pushToOneSignal, generateUUID } from '../utils';
import { ui } from '../render/ui';
import { t } from '../i18n';
import { hasLocalSyncKey, getSyncKey, apiFetch } from './api';
import { renderApp, updateNotificationUI } from '../render';
import { mergeStates } from './dataMerge';

// PERFORMANCE: Debounce para evitar salvar na nuvem a cada pequena alteração (ex: digitar uma nota).
// Reduz chamadas de API e overhead de criptografia (bateria).
let syncTimeout: number | null = null;
const DEBOUNCE_DELAY = 2000; // 2 segundos

// CRITICAL LOGIC: Mutex de Sincronização.
// Variáveis de estado para prevenir condições de corrida (Race Conditions) na rede.
// Garante que apenas uma operação de sync ocorra por vez.
let isSyncInProgress = false;
let pendingSyncState: AppState | null = null;

// --- WORKER INFRASTRUCTURE [2025-02-28] ---
// Singleton lazy-loaded worker instance.
let syncWorker: Worker | null = null;
// Map para correlacionar requisições e respostas do Worker via IDs únicos.
const workerCallbacks = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

function getWorker(): Worker {
    // PERFORMANCE: Lazy Loading.
    // Só instanciamos o worker se e quando for necessário (ex: usuário ativa sync ou pede análise IA).
    // Isso economiza memória e tempo de boot para usuários locais.
    if (!syncWorker) {
        // O nome do arquivo deve corresponder à saída configurada no build.js
        syncWorker = new Worker('./sync-worker.js', { type: 'module' });
        
        // Configura o listener global para receber respostas do worker
        syncWorker.onmessage = (e) => {
            const { id, status, result, error } = e.data;
            // Correlaciona a resposta com a promessa original via ID
            const callback = workerCallbacks.get(id);
            if (callback) {
                if (status === 'success') {
                    callback.resolve(result);
                } else {
                    callback.reject(new Error(error));
                }
                workerCallbacks.delete(id);
            }
        };
        
        syncWorker.onerror = (e) => {
            console.error("Critical Worker Error:", e);
        };
    }
    return syncWorker;
}

/**
 * PERFORMANCE OPTIMIZATION: Worker Pre-warming.
 * Inicializa o worker antecipadamente (ex: ao abrir o modal de chave) para remover
 * a latência de boot do worker durante a submissão do formulário.
 */
export function preloadWorker() {
    getWorker();
}

/**
 * Ponte de comunicação assíncrona com o Worker.
 * Envia uma tarefa e retorna uma Promise que resolve quando o Worker responder.
 * 
 * @param type Tipo da operação (deve ser suportada pelo switch case do worker).
 * @param payload Dados para processamento.
 * @param key (Opcional) Chave de criptografia/sincronização.
 */
export function runWorkerTask<T>(type: 'encrypt' | 'decrypt' | 'build-ai-prompt' | 'archive', payload: any, key?: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = generateUUID();
        // Armazena os handlers da Promise para serem chamados quando o worker responder com este ID.
        workerCallbacks.set(id, { resolve, reject });
        getWorker().postMessage({ id, type, payload, key });
    });
}

// Interface para a carga de dados que o servidor manipula (Blob opaco)
interface ServerPayload {
    lastModified: number;
    state: string; // Esta é a string criptografada
}

export function setSyncStatus(statusKey: 'syncSaving' | 'syncSynced' | 'syncError' | 'syncInitial') {
    state.syncState = statusKey;
    // PERFORMANCE: Atualização direta do DOM, ignorando o ciclo de renderização completo se possível.
    if (ui.syncStatus) {
        ui.syncStatus.textContent = t(statusKey);
    }
}

/**
 * Configura os listeners de notificação e atualiza a UI inicial.
 */
export function setupNotificationListeners() {
    // A inicialização do SDK do OneSignal agora é feita diretamente no index.html.
    // Esta função apenas anexa os listeners de eventos necessários para a UI.
    pushToOneSignal((OneSignal: any) => {
        // Este listener garante que a UI seja atualizada se o usuário alterar
        // as permissões de notificação nas configurações do navegador enquanto o app estiver aberto.
        OneSignal.Notifications.addEventListener('permissionChange', () => {
            // UX: Adia a atualização da UI para dar tempo ao SDK de atualizar seu estado interno.
            setTimeout(updateNotificationUI, 500);
        });

        // Atualiza a UI no carregamento inicial, caso o estado já esteja definido.
        updateNotificationUI();
    });
}

/**
 * Lida com um conflito de sincronização, onde o servidor tem uma versão mais recente dos dados.
 * Atualiza o estado local e a UI para corresponder à versão do servidor.
 * @param serverPayload O payload autoritativo (e criptografado) recebido do servidor.
 */
async function resolveConflictWithServerState(serverPayload: ServerPayload) {
    console.warn("Sync conflict detected. Initiating Smart Merge sequence.");
    
    const syncKey = getSyncKey();
    if (!syncKey) {
        console.error("Cannot resolve conflict without sync key.");
        setSyncStatus('syncError');
        return;
    }
    
    try {
        // DO NOT REFACTOR: Worker Offload Crítico.
        // A decriptografia e o parsing de JSON podem bloquear a main thread por 50-200ms
        // dependendo do tamanho do histórico. Isso DEVE ocorrer no worker para evitar travamento da UI.
        const serverState = await runWorkerTask<AppState>('decrypt', serverPayload.state, syncKey);

        // IMPLEMENTAÇÃO DE SMART MERGE [2025-02-23]:
        // Em vez de perguntar ao usuário (que pode não saber qual versão está correta),
        // nós mesclamos os estados matematicamente para preservar o máximo de dados.
        
        // 1. Snapshot do estado local atual
        // REFACTOR [2025-03-04]: Utiliza helper centralizado para evitar duplicação
        const localState = getPersistableState();

        // 2. Executa a fusão (usando a função importada)
        // Nota: O merge ainda é feito na main thread pois é rápido (lógica de negócio pura), 
        // mas poderia ser movido para o worker se a estrutura AppState crescer muito.
        const mergedState = mergeStates(localState, serverState);
        console.log("Smart Merge completed successfully.");

        // 3. Persiste e Carrega o novo estado unificado
        // ASYNC PERSISTENCE: Aguarda a escrita no IDB antes de atualizar a UI.
        await persistStateLocally(mergedState);
        await loadState(mergedState);
        
        // 4. Atualiza a UI
        renderApp();
        setSyncStatus('syncSynced'); // UI otimista
        document.dispatchEvent(new CustomEvent('habitsChanged'));

        // 5. CRÍTICO: Envia o estado mesclado de volta para a nuvem.
        // Isso resolve o conflito no servidor, tornando este novo estado a "versão mais recente"
        // para todos os outros dispositivos.
        // Usamos 'immediate=true' para resolver o mais rápido possível.
        syncStateWithCloud(mergedState, true);
        
    } catch (error) {
        console.error("Failed to resolve conflict with server state:", error);
        setSyncStatus('syncError');
    }
}

/**
 * Executa a requisição de rede real para sincronizar o estado com a nuvem.
 * CRITICAL LOGIC: Implementa um Mutex (isSyncInProgress) para serializar os salvamentos.
 */
async function performSync() {
    // DO NOT REFACTOR: Race Condition Guard.
    // Se já estamos sincronizando ou não há nada pendente, aborta.
    if (isSyncInProgress || !pendingSyncState) {
        return;
    }

    // Lock Mutex
    isSyncInProgress = true;
    const appState = pendingSyncState;
    pendingSyncState = null; // Consome o estado pendente, liberando o slot.

    const syncKey = getSyncKey();
    if (!syncKey) {
        setSyncStatus('syncError');
        console.error("Cannot sync without a sync key.");
        isSyncInProgress = false; // Release Mutex
        return;
    }

    try {
        // DO NOT REFACTOR: Worker Offload Crítico.
        // 1. Serialização JSON (CPU intensive)
        // 2. Criptografia AES-GCM (CPU intensive)
        // Ocorrem na thread secundária para manter a UI fluida (60fps) durante o status "Salvando...".
        const encryptedState = await runWorkerTask<string>('encrypt', appState, syncKey);

        const payload: ServerPayload = {
            lastModified: appState.lastModified,
            state: encryptedState,
        };
        
        // Network IO
        const response = await apiFetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify(payload),
        }, true);

        if (response.status === 409) {
            // Conflito: o servidor tem dados mais recentes.
            const serverPayload: ServerPayload = await response.json();
            await resolveConflictWithServerState(serverPayload);
        } else {
            // Sucesso (a verificação de response.ok já foi feita em apiFetch).
            setSyncStatus('syncSynced');
            document.dispatchEvent(new CustomEvent('habitsChanged')); // Notifica o emblema/etc para atualizar
        }
    } catch (error) {
        console.error("Error syncing state to cloud:", error);
        setSyncStatus('syncError');
    } finally {
        // Release Mutex
        isSyncInProgress = false;
        
        // DO NOT REFACTOR: Queue Processing (Recursion).
        // Se um novo estado foi salvo (pendingSyncState != null) ENQUANTO a sincronização estava em andamento,
        // aciona uma nova sincronização imediatamente para processar a fila e garantir consistência final.
        if (pendingSyncState) {
            if (syncTimeout) clearTimeout(syncTimeout);
            performSync();
        }
    }
}

/**
 * Agenda uma sincronização com a nuvem.
 * Implementa estratégia de 'Debounce' para não sobrecarregar a rede/bateria em digitação rápida.
 * @param appState O estado da aplicação a ser sincronizado.
 * @param immediate Se true, ignora o debounce e tenta sincronizar o mais rápido possível (ex: fechamento de aba).
 */
export function syncStateWithCloud(appState: AppState, immediate = false) {
    if (!hasLocalSyncKey()) return;

    pendingSyncState = appState; // Sempre atualiza a referência para o estado mais recente (Last Write Wins local).
    setSyncStatus('syncSaving');

    if (syncTimeout) clearTimeout(syncTimeout);
    
    // Se uma sincronização já estiver em andamento, o bloco `finally` de `performSync`
    // cuidará de acionar a próxima recursivamente. Não precisamos fazer nada aqui.
    if (isSyncInProgress) {
        return;
    }

    if (immediate) {
        performSync();
    } else {
        syncTimeout = window.setTimeout(performSync, DEBOUNCE_DELAY);
    }
}

export async function fetchStateFromCloud(): Promise<AppState | undefined> {
    if (!hasLocalSyncKey()) return undefined;

    const syncKey = getSyncKey();
    if (!syncKey) return undefined;

    try {
        const response = await apiFetch('/api/sync', {}, true);
        const data: ServerPayload | null = await response.json();

        if (data && data.state) {
            // DO NOT REFACTOR: Worker Offload para decriptografia no boot.
            // Essencial para um TTI (Time to Interactive) rápido se o payload for grande.
            const appState = await runWorkerTask<AppState>('decrypt', data.state, syncKey);
            
            setSyncStatus('syncSynced');
            return appState;
        } else {
            // Nenhum dado na nuvem (resposta foi 200 com corpo nulo)
            console.log("No state found in cloud for this sync key. Performing initial sync.");
            
            // FIX [2025-03-20]: Use getPersistableState() instead of reading from localStorage.
            // Persistence is now abstracted (IndexedDB). If memory state is populated, sync it.
            if (state.habits.length > 0 || Object.keys(state.dailyData).length > 0) {
                // Empurra o estado local atual para a nuvem
                syncStateWithCloud(getPersistableState(), true);
            }
            return undefined;
        }
    } catch (error) {
        console.error("Failed to fetch state from cloud:", error);
        setSyncStatus('syncError');
        throw error;
    }
}
