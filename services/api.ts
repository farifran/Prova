
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file services/api.ts
 * @description Camada de Rede e Gerenciamento de Identidade (Sync Key).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia a comunicação com o backend (Edge Functions) e a persistência segura de credenciais.
 * 
 * ARQUITETURA (Robustez & Performance):
 * - **Responsabilidade Única:** Abstrair `fetch` com lógica de retry, timeout e autenticação automática.
 * - **Security First:** Utiliza `Web Crypto API` (nativa) para hash de chaves, evitando o envio da chave bruta pela rede.
 * - **Zero-Allocation Hashing:** Otimizações de memória (Hoisting e Lookup Tables) para operações criptográficas frequentes.
 * - **Network Resilience:** Implementa "Exponential Backoff" para lidar com instabilidades de rede móvel (PWA).
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `crypto.subtle`: Requer Contexto Seguro (HTTPS ou localhost).
 * - `localStorage`: Persistência síncrona da chave.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Hex Lookup Table:** Conversão Byte-para-Hex via array pré-alocado é significativamente mais rápida que `toString(16)` em loops.
 * 2. **Cache de Hash:** O hash da chave é memoizado (`keyHashCache`) para evitar reprocessamento criptográfico a cada request.
 * 3. **Keepalive:** Requisições críticas usam a flag `keepalive` para sobreviver ao fechamento da aba/app.
 */

// UPDATE [2025-01-17]: Adicionada lógica de retry com backoff exponencial para maior robustez em rede.

const SYNC_KEY_STORAGE_KEY = 'habitTrackerSyncKey';
const UUID_REGEX = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/;

let localSyncKey: string | null = null;
let keyHashCache: string | null = null;

// OPTIMIZATION [2025-03-14]: Hoisted TextEncoder and Pre-calculated Hex Table.
// PERFORMANCE: Reduz alocação de memória (GC Pressure) durante operações de hash repetitivas.
// Instanciar TextEncoder é barato, mas em hot paths, cada microssegundo conta.
const encoder = new TextEncoder();

// PERFORMANCE: Lookup Table pré-calculada (00-FF).
// Acesso a array O(1) é muito mais rápido que chamadas de método `number.toString(16).padStart(...)`.
const HEX_TABLE = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

// --- Authentication / Key Management ---

export function initAuth() {
    try {
        localSyncKey = localStorage.getItem(SYNC_KEY_STORAGE_KEY);
    } catch (e) {
        console.warn("Auth storage access blocked. Sync disabled.");
        localSyncKey = null;
    }
}

export function storeKey(key: string) {
    localSyncKey = key;
    // MANUTENIBILIDADE [2024-01-16]: Limpa o cache de hash sempre que a chave muda para garantir consistência.
    keyHashCache = null; 
    try {
        localStorage.setItem(SYNC_KEY_STORAGE_KEY, key);
    } catch (e) {
        console.error("Failed to persist sync key:", e);
    }
}

export function clearKey() {
    localSyncKey = null;
    keyHashCache = null;
    try {
        localStorage.removeItem(SYNC_KEY_STORAGE_KEY);
    } catch (e) {
        console.warn("Failed to clear sync key from storage:", e);
    }
}

export function hasLocalSyncKey(): boolean {
    return localSyncKey !== null;
}

export function getSyncKey(): string | null {
    return localSyncKey;
}

export function isValidKeyFormat(key: string): boolean {
    return UUID_REGEX.test(key);
}

async function hashKey(key: string): Promise<string> {
    if (!key) return '';
    
    // ROBUSTEZ: crypto.subtle requer um contexto seguro (HTTPS ou localhost).
    // Em um PWA instalado, isso é garantido, mas adicionamos verificação para ambientes de dev.
    if (!crypto.subtle) {
        console.warn("crypto.subtle not available. Ensure you are running on localhost or HTTPS.");
        return '';
    }

    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // PERFORMANCE OPTIMIZATION: Use Lookup Table instead of map/padStart.
    // Significantly faster for byte-to-hex conversion.
    const hashArray = new Uint8Array(hashBuffer);
    const len = hashArray.length;
    // PERFORMANCE: Pré-alocação do array de destino.
    const hexChars = new Array(len);
    
    // PERFORMANCE: Loop for clássico é mais rápido que .map() ou .reduce() em V8.
    for (let i = 0; i < len; i++) {
        hexChars[i] = HEX_TABLE[hashArray[i]];
    }
    
    return hexChars.join('');
}

export async function getSyncKeyHash(): Promise<string | null> {
    if (!localSyncKey) {
        return null;
    }
    // PERFORMANCE: Retorna valor memoizado se disponível.
    if (keyHashCache) {
        return keyHashCache;
    }
    keyHashCache = await hashKey(localSyncKey);
    return keyHashCache;
}

// --- Networking ---

interface ExtendedRequestInit extends RequestInit {
    timeout?: number;
    retries?: number; // Número máximo de tentativas
    backoff?: number; // Delay inicial em ms
}

/**
 * Wrapper for the fetch API that includes the sync key hash, handles timeouts,
 * and implements exponential backoff retry logic for robust networking.
 * 
 * [MAIN THREAD CONTEXT]: Operação assíncrona, não bloqueia a UI, mas consome recursos de rede.
 */
export async function apiFetch(endpoint: string, options: ExtendedRequestInit = {}, includeSyncKey = false): Promise<Response> {
    // [2024-01-16] REFACTOR: Uso da classe Headers para manipulação mais limpa e segura de headers.
    // Inicializa com os headers fornecidos nas opções (se houver)
    const headers = new Headers(options.headers);

    // Define Content-Type padrão se não tiver sido sobrescrito pelo chamador
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    if (includeSyncKey) {
        const keyHash = await getSyncKeyHash();
        if (keyHash) {
            headers.set('X-Sync-Key-Hash', keyHash);
        }
    }

    const { 
        timeout = 15000, 
        retries = 2, // Padrão: tenta 3 vezes no total (1 inicial + 2 retries)
        backoff = 500, // Padrão: espera 500ms antes do primeiro retry
        ...fetchOptions 
    } = options;

    const attemptFetch = async (attempt: number): Promise<Response> => {
        // ROBUSTEZ: AbortController para timeout real da requisição.
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(endpoint, {
                ...fetchOptions,
                headers,
                signal: controller.signal,
                // ROBUSTNESS [2025-03-16]: Keepalive ensures requests survive page unloads/navigation.
                // Critical for data persistence on close (Sync on Exit).
                keepalive: true,
            });
            clearTimeout(timeoutId);

            // CRITICAL LOGIC: Retry Strategy.
            // Lógica de Retry para erros de servidor (5xx) ou falhas de rede.
            // Erros de cliente (4xx) geralmente não devem ser retentados (exceto talvez 408/429, mas simplificamos aqui).
            // 409 (Conflict) é uma resposta válida de lógica de negócios para sync, então retornamos.
            if (!response.ok && response.status !== 409 && response.status >= 500 && attempt < retries) {
                throw new Error(`Server error ${response.status}`);
            }
            
            // Se for um erro não recuperável (4xx) ou se acabaram as tentativas, processamos o erro.
            if (!response.ok && response.status !== 409) {
                let errorBody = '';
                try {
                    errorBody = await response.text();
                } catch (e) {
                    errorBody = '[No response body or failed to parse]';
                }
                console.error(`API request failed to ${endpoint}:`, errorBody);
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }

            return response;

        } catch (error: any) {
            clearTimeout(timeoutId);
            
            const isAbortError = error.name === 'AbortError';
            const isNetworkError = error instanceof TypeError || error.message.includes('Server error'); // TypeError geralmente é erro de rede no fetch

            // CRITICAL LOGIC: Exponential Backoff.
            // Se falhou e ainda temos tentativas, espera um tempo crescente (500ms, 1000ms, 2000ms...)
            if (attempt < retries && (isAbortError || isNetworkError)) {
                const delay = backoff * Math.pow(2, attempt); // Backoff exponencial
                console.warn(`API attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
                return attemptFetch(attempt + 1);
            }

            if (isAbortError) {
                throw new Error(`API request to ${endpoint} timed out after ${timeout}ms.`);
            }
            throw error;
        }
    };

    return attemptFetch(0);
}
