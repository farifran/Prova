
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file index.tsx
 * @description Bootstrapper e Orquestrador de Ciclo de Vida da Aplicação.
 * 
 * [MAIN THREAD CONTEXT]:
 * Este é o ponto de entrada (Entry Point). Ele roda na thread principal e bloqueia o
 * "First Contentful Paint" (FCP) lógico da aplicação (hidratação de dados).
 * 
 * ARQUITETURA (Race-to-Idle):
 * - Prioridade Absoluta: Carregar dados, resolver conflitos de versão e pintar a UI o mais rápido possível.
 * - Lazy Loading: Serviços não críticos (Analytics, Workers) são inicializados apenas após a UI estar interativa.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `services/persistence.ts`: Camada de IO assíncrono (IndexedDB) para inicialização escalável.
 * - `services/cloud.ts`: Camada de IO assíncrono para consistência de dados.
 * - `services/dataMerge.ts`: Algoritmo de resolução de conflitos (CRDT-lite).
 * 
 * DECISÕES TÉCNICAS:
 * 1. Inicialização Bifurcada: Tenta carregar do disco (rápido) e da nuvem (lento) em paralelo, 
 *    aplicando uma estratégia de "Smart Merge" se ambos existirem.
 * 2. Analytics Condicional: Injeção de scripts de rastreamento apenas em produção para não poluir
 *    o console de desenvolvimento nem afetar métricas de performance locais.
 */

import { inject } from '@vercel/analytics';
import './index.css';
import { state, AppState } from './state';
import { loadState, persistStateLocally, registerSyncHandler } from './services/persistence';
import { renderApp, initI18n } from './render';
import { setupEventListeners } from './listeners';
// I18N moved to render.ts to fix circular dependency
import { createDefaultHabit, handleDayTransition } from './habitActions';
import { initSync } from './listeners/sync';
import { fetchStateFromCloud, setupNotificationListeners, syncStateWithCloud } from './services/cloud';
import { hasLocalSyncKey, initAuth } from './services/api';
import { updateAppBadge } from './services/badge';
import { mergeStates } from './services/dataMerge';
import { setupMidnightLoop } from './utils';

// --- SERVICE WORKER REGISTRATION ---
// PWA CORE: Garante capacidade Offline-First.
const registerServiceWorker = () => {
    // PERFORMANCE: Verifica suporte antes de tentar registrar para evitar erros em ambientes antigos.
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
        const doRegister = async () => {
            try {
                // Caminho relativo ./sw.js para maior compatibilidade
                const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            } catch (err) {
                console.error('ServiceWorker registration failed: ', err);
            }
        };

        // PERFORMANCE: Atrasa o registro até o load completo para não competir por banda/CPU durante a hidratação inicial.
        if (document.readyState === 'complete') {
            doRegister();
        } else {
            window.addEventListener('load', doRegister);
        }
    } else if (window.location.protocol === 'file:') {
        console.warn('Service Worker não suportado no protocolo file://. Por favor, use um servidor local (npm run dev).');
    }
};


// --- PRIVATE HELPERS (INIT ORCHESTRATION) ---

async function setupBase() {
    initAuth(); // Inicializa a autenticação (lê a chave de sincronização) antes de carregar o estado
    await initI18n(); // Carrega as traduções (Network Request ou Cache)
}

/**
 * CRITICAL LOGIC: State Reconciliation / Smart Merge.
 * Esta função decide a "Verdade" dos dados do usuário.
 * 1. Tenta carga Local (Async IDB).
 * 2. Se houver chave, tenta carga Nuvem (Assíncrona).
 * 3. Se houver conflito (ambos existem), executa Merge baseado em timestamps (`lastModified`).
 * DO NOT REFACTOR: Alterar a ordem ou a lógica de comparação pode causar perda de dados (Data Loss).
 */
async function loadInitialState() {
    // IDB é assíncrono, mas precisamos aguardar para garantir estado consistente antes de renderizar
    
    // A função loadState do persistence.ts já lida internamente com:
    // 1. Tentar ler do IDB
    // 2. Se falhar/vazio, tentar ler do LocalStorage (Migração)
    // 3. Hidratar o objeto 'state' global
    
    // Simula a leitura para obter o objeto e comparar datas.
    // Usamos o retorno de loadState para ter acesso ao objeto AppState completo (com version e lastModified),
    // que não estão disponíveis no singleton global `state`.
    const localState = await loadState(); 
    
    if (hasLocalSyncKey()) {
        try {
            // PERFORMANCE: Network blocking call. UI Loader is visible here.
            const cloudState = await fetchStateFromCloud();

            if (cloudState && localState) {
                console.log("Startup: Both local and cloud state exist. Performing Smart Merge.");
                let stateToLoad: AppState;
                
                // A base para a fusão é o estado mais recente.
                if (localState.lastModified > cloudState.lastModified) {
                    stateToLoad = mergeStates(cloudState, localState);
                    // Como a fusão resultou em um estado mais novo que o da nuvem, sincronizamos de volta.
                    // 'true' force immediate sync.
                    syncStateWithCloud(stateToLoad, true);
                } else {
                    stateToLoad = mergeStates(localState, cloudState);
                }
                
                // Re-hidrata e persiste o estado fundido
                // Importante: persistStateLocally agora é async (IDB)
                await persistStateLocally(stateToLoad);
                await loadState(stateToLoad); // Re-hidrata global com o merged
                
            } else if (cloudState) {
                // Apenas o estado da nuvem existe, ou o local é nulo (Novo dispositivo).
                console.log("Startup: Using cloud state as the source of truth.");
                await persistStateLocally(cloudState);
                await loadState(cloudState);
            } else if (localState) {
                // Apenas o estado local existe (ex: primeira sincronização após criar chave).
                console.log("Startup: No cloud data found, pushing local state to cloud.");
                syncStateWithCloud(localState as AppState, true);
            }
            
        } catch (e) {
            console.error("Startup: Failed to process cloud state, falling back to local.", e);
            // Em caso de erro de rede, o estado local (já carregado pelo primeiro loadState) permanece.
        }
    }
}

function handleFirstTimeUser() {
    // UX: Se não houver dados, cria um hábito de exemplo para evitar o "Blank Slate Trauma".
    if (state.habits.length === 0) {
        createDefaultHabit();
    }
}

function setupAppListeners() {
    // WIRE UP SYNC: Connect state changes to cloud sync
    // Registra o handler para que saveState() dispare syncStateWithCloud() automaticamente.
    registerSyncHandler(syncStateWithCloud);
    
    setupEventListeners();
    setupNotificationListeners();
    initSync();
    
    // BUGFIX: Garante que o emblema da PWA (App Badge) seja atualizado em tempo real.
    document.addEventListener('habitsChanged', updateAppBadge);

    // MIDNIGHT HANDLER: Garante que a UI atualize na virada do dia.
    setupMidnightLoop();
    document.addEventListener('dayChanged', handleDayTransition);
}

function finalizeInit(loader: HTMLElement | null) {
    if (loader) {
        // UX: Transição suave (Fade-out) para evitar "Pop-in" agressivo do conteúdo.
        loader.classList.add('hidden');
        loader.addEventListener('transitionend', () => loader.remove());
    }
    
    // FIX [2025-02-28]: Injeta Analytics apenas em produção para evitar erros 404 no console de desenvolvimento.
    // O script /_vercel/insights/script.js é virtual e só existe na infraestrutura da Vercel.
    // PERFORMANCE: Injeção tardia para não bloquear a thread principal durante o boot.
    if (process.env.NODE_ENV === 'production') {
        inject(); 
    }
}

// --- MAIN INITIALIZATION ---
async function init(loader: HTMLElement | null) {
    await setupBase(); // I18n & Auth
    await loadInitialState(); // Data IO & Merge (Async IDB)
    handleFirstTimeUser(); // Onboarding logic
    renderApp(); // First Paint (DOM Hydration)
    setupAppListeners(); // Event Binding
    updateAppBadge(); // Define o emblema inicial
    finalizeInit(loader); // Cleanup & Analytics
}

registerServiceWorker();

const startApp = () => {
    // OTIMIZAÇÃO: Busca o loader por ID (O(1)) para passar para a função de init.
    const initialLoader = document.getElementById('initial-loader');
    init(initialLoader).catch(err => {
        console.error("Failed to initialize application:", err);
        // UX: Fallback visual em caso de erro crítico no boot.
        if(initialLoader) {
            initialLoader.innerHTML = '<h2>Falha ao carregar a aplicação. Por favor, tente novamente.</h2>'
        }
    });
};

// FIX [2025-03-04]: Ensure DOM is fully loaded before initialization.
// This prevents "element not found" errors if the script runs before the HTML parser finishes.
// PERFORMANCE: Se já estiver carregado, inicia imediatamente (Fast Path).
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
