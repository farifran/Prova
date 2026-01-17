
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file sw.js
 * @description Service Worker: Proxy de Rede e Gerenciador de Cache (Offline Engine).
 * 
 * [SERVICE WORKER CONTEXT]:
 * Este arquivo roda em uma thread de background separada da Main Thread.
 * - SEM acesso ao DOM (window, document).
 * - Ciclo de vida independente da página.
 * - Atua como proxy de rede programável.
 * 
 * ARQUITETURA (App Shell & Atomic Caching):
 * - **Responsabilidade Única:** Garantir que a aplicação carregue instantaneamente (via Cache Storage)
 *   e funcione offline, interceptando requisições de rede.
 * - **Atomic Installation:** A instalação falha propositalmente se *qualquer* arquivo crítico falhar.
 *   Isso previne o estado de "Zumbi" onde o app carrega parcialmente quebrado.
 * - **Cache Busting:** O `CACHE_NAME` é versionado automaticamente pelo `build.js` via Regex.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `build.js`: Injeta o timestamp no `CACHE_NAME` durante o build.
 * - `manifest.json`: Referenciado nos arquivos cacheados.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Network-Only para API:** Bypass explícito para `/api/` garante dados frescos.
 * 2. **Stale-While-Revalidate (Conceitual):** O App Shell é servido do cache, enquanto dados
 *    dinâmicos são buscados via JS.
 * 3. **Force Reload:** Durante a instalação, usamos `cache: 'reload'` para ignorar o cache HTTP do navegador
 *    e garantir que o SW armazene a versão mais recente do servidor.
 */

// [NOTA COMPARATIVA]: Nível de Engenharia: Crítico/Infraestrutura. Código de alta resiliência. Diferente de 'state.ts' (lógica) ou 'render.ts' (UI), bugs aqui podem causar falhas permanentes (zombie workers). A lógica de instalação agora garante integridade atômica do cache.
// UPDATE [2025-02-23]: Critical Fix - Installation now fails if core assets cannot be fetched, preventing incomplete cache states.

try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
} catch (e) {
    console.warn("Failed to load OneSignal SDK in Service Worker. Push notifications might not work.", e);
}

// DO NOT REFACTOR: O script de build (build.js) procura exatamente por esta string via Regex
// para injetar o timestamp de versão (ex: habit-tracker-v1740...).
// Alterar a formatação desta linha quebrará o sistema de atualização automática do PWA.
const CACHE_NAME = 'habit-tracker-v2';

// Arquivos essenciais para o App Shell.
// PERFORMANCE: Estes arquivos são pré-carregados na instalação.
const CACHE_FILES = [
    '/',
    '/index.html',
    '/bundle.js',
    '/bundle.css',
    '/sync-worker.js', // WORKER [2025-02-28]: Adicionado ao cache para suporte offline
    '/manifest.json',
    '/locales/pt.json',
    '/locales/en.json',
    '/locales/es.json',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    '/icons/icon-maskable-512.svg',
    '/icons/badge.svg'
];

self.addEventListener('install', (event) => {
    // CRITICAL LOGIC: Atomic Caching Transaction.
    // O SW só é considerado "instalado" se TODAS as promessas resolverem.
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);
            console.log('Service Worker: Caching App Shell (Network Forced)');
            
            // FORÇA a atualização do cache via rede ('reload') para garantir que a nova versão seja baixada.
            // ATOMICIDADE [2025-02-23]: Se qualquer arquivo crítico falhar, a instalação DEVE falhar.
            await Promise.all(CACHE_FILES.map(async (url) => {
                try {
                    // PERFORMANCE: Bypassa o cache HTTP do browser para garantir frescor dos assets.
                    const request = new Request(url, { cache: 'reload' });
                    const response = await fetch(request);
                    if (!response.ok) throw new Error(`Status ${response.status}`);
                    return cache.put(request, response);
                } catch (err) {
                    console.error(`Failed to cache ${url}:`, err);
                    throw err; // Propaga o erro para abortar a instalação
                }
            }));

            // PERFORMANCE: Ativa o novo SW imediatamente, sem esperar que o antigo seja fechado.
            self.skipWaiting();
        } catch (error) {
            console.error('Service Worker: Install failed', error);
            // RE-THROW CRÍTICO: Garante que o navegador saiba que a instalação falhou.
            // Sem isso, o SW seria considerado "instalado" mesmo com cache incompleto.
            throw error;
        }
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Assume o controle das páginas abertas imediatamente (sem reload necessário).
        await self.clients.claim();
        
        // CRITICAL LOGIC: Cache Cleanup.
        // Remove caches antigos para liberar espaço no dispositivo do usuário.
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter(cacheName => cacheName !== CACHE_NAME)
                .map(cacheName => caches.delete(cacheName))
        );
    })());
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // CRITICAL LOGIC: API Bypass.
    // Requisições para API (/api/*) nunca devem ser cacheadas pelo SW.
    // Elas precisam de dados em tempo real ou falhar se offline.
    if (url.pathname.startsWith('/api/')) {
        return;
    }

    // ESTRATÉGIA CACHE-FIRST PARA NAVEGAÇÃO (App Shell)
    // Garante que o index.html seja carregado instantaneamente, permitindo que o JS assuma o routing.
    if (event.request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                // 1. Prioridade total ao Cache (ignorando query string para deep links)
                const cachedResponse = await caches.match('/index.html', { ignoreSearch: true });
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                // 2. Fallback de Rede (caso o cache falhe ou não exista)
                return await fetch(event.request);
            } catch (error) {
                console.error('Navigation failed:', error);
                // 3. Última tentativa de cache (para resiliência offline extrema)
                return caches.match('/index.html', { ignoreSearch: true });
            }
        })());
        return;
    }

    // Estratégia Cache-First para Assets Estáticos
    // PERFORMANCE: Evita round-trip na rede para imagens, CSS, JS e fontes.
    event.respondWith((async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
            return cachedResponse;
        }
        try {
            return await fetch(event.request);
        } catch (error) {
            // Opcional: retornar placeholder se necessário
        }
    })());
});
