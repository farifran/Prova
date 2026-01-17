
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file api/sync.ts
 * @description Endpoint serverless (Edge Function) para sincronização de estado criptografado via Vercel KV.
 * 
 * [SERVERLESS / EDGE FUNCTION CONTEXT]:
 * Este código roda na infraestrutura da Vercel (Edge Network), NÃO no navegador.
 * - SEM acesso ao DOM, window, localStorage ou IndexedDB.
 * - Otimizado para baixa latência e execução rápida (Cold Start mínimo).
 * - ARQUITETURA "ZERO KNOWLEDGE": Este servidor atua como um "Cofre Cego". Ele armazena blobs de dados
 *   criptografados pelo cliente (AES-GCM) e não possui a chave para descriptografá-los.
 * 
 * RESPONSABILIDADE:
 * 1. Autenticação via Hash da Chave (X-Sync-Key-Hash).
 * 2. Armazenamento persistente (KV) com verificação de integridade básica.
 * 3. Gerenciamento de Concorrência (Optimistic Locking) via timestamps.
 */

import { kv } from '@vercel/kv';

// PERFORMANCE: Define o runtime como 'edge' para inicialização instantânea globalmente.
// Isso é crucial para que a sincronização não pareça lenta para o usuário final.
export const config = {
  runtime: 'edge',
};

// --- Constantes ---
// MELHORIA DE ROBUSTEZ: Define um limite de tamanho para o payload (1MB) para prevenir abuso e custos excessivos no KV.
const MAX_PAYLOAD_SIZE = 1 * 1024 * 1024; 

// --- Tipos e Interfaces ---
// CONSOLIDAÇÃO DE TIPO: Estrutura do payload trocado entre cliente e servidor.
// 'state' é uma string opaca (JSON stringificado contendo iv, salt e ciphertext).
interface SyncPayload {
    lastModified: number;
    state: string; // string criptografada (Blob opaco para o servidor)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key-Hash',
};

const createErrorResponse = (message: string, status: number, details = '') => {
    return new Response(JSON.stringify({ error: message, details }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
};

// SECURITY: A chave de sincronização nunca é enviada crua. O cliente envia um Hash SHA-256 da chave.
// Isso permite que o servidor use o hash como chave de busca no banco de dados sem conhecer a chave original (que deriva a senha de criptografia).
const getSyncKeyHash = (req: Request): string | null => {
    return req.headers.get('x-sync-key-hash');
};

/**
 * REATORAÇÃO DE MODULARIDADE: Lida com requisições GET.
 * Recupera o estado mais recente do KV.
 * @param dataKey A chave para buscar no Vercel KV (derivada do hash).
 * @returns Uma resposta com os dados armazenados ou null.
 */
async function handleGetRequest(dataKey: string): Promise<Response> {
    // PERFORMANCE: Leitura direta do KV (baixa latência).
    const storedData = await kv.get<SyncPayload>(dataKey);
    return new Response(JSON.stringify(storedData || null), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

/**
 * REATORAÇÃO DE MODULARIDADE: Lida com requisições POST.
 * Implementa a lógica crítica de salvamento com verificação de conflito.
 * @param req O objeto da requisição.
 * @param dataKey A chave para buscar/armazenar no Vercel KV.
 * @returns Uma resposta indicando sucesso (200), conflito (409) ou não modificado (304).
 */
async function handlePostRequest(req: Request, dataKey: string): Promise<Response> {
    let clientPayload: SyncPayload;
    try {
        clientPayload = await req.json();
    } catch (e) {
        return createErrorResponse('Bad Request: Invalid JSON format', 400);
    }

    if (!clientPayload || typeof clientPayload.lastModified !== 'number' || typeof clientPayload.state !== 'string') {
        return createErrorResponse('Bad Request: Invalid or missing payload data', 400);
    }
    
    // MELHORIA DE ROBUSTEZ: Verifica o tamanho do payload para evitar sobrecarga do armazenamento.
    if (clientPayload.state.length > MAX_PAYLOAD_SIZE) {
        return createErrorResponse('Payload Too Large', 413, `Payload size exceeds the limit of ${MAX_PAYLOAD_SIZE} bytes.`);
    }

    // CRITICAL LOGIC [OPTIMISTIC LOCKING]:
    // Antes de salvar, lemos o estado atual para verificar versões.
    const storedData = await kv.get<SyncPayload>(dataKey);

    if (storedData) {
        // Otimização: Se o timestamp é idêntico, não gastamos escrita no KV.
        if (clientPayload.lastModified === storedData.lastModified) {
            return new Response(null, {
                status: 304, // Not Modified
                headers: corsHeaders,
            });
        }
        
        // DO NOT REFACTOR: Detecção de Conflito.
        // Se o cliente tenta salvar um estado com timestamp MENOR que o do servidor,
        // significa que o cliente está desatualizado. Rejeitamos o salvamento e retornamos
        // o estado do servidor para que o cliente possa fazer o merge.
        if (clientPayload.lastModified < storedData.lastModified) {
            return new Response(JSON.stringify(storedData), {
                status: 409, // Conflict
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
    }

    // Se chegamos aqui, o payload do cliente é mais novo (ou é o primeiro salvamento).
    // Sobrescrevemos o KV.
    await kv.set(dataKey, clientPayload);
    
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}

export default async function handler(req: Request) {
    // Tratamento de CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const keyHash = getSyncKeyHash(req);

        if (!keyHash) {
            return createErrorResponse('Unauthorized: Missing sync key hash', 401);
        }
        
        // Isola os dados por hash da chave de sincronização
        const dataKey = `sync_data:${keyHash}`;

        if (req.method === 'GET') {
            return await handleGetRequest(dataKey);
        }

        if (req.method === 'POST') {
            return await handlePostRequest(req, dataKey);
        }

        return createErrorResponse('Method not allowed', 405);

    } catch (error) {
        console.error("Error in sync API handler:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        return createErrorResponse('Internal Server Error', 500, errorMessage);
    }
}
