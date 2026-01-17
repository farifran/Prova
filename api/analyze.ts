
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file api/analyze.ts
 * @description Proxy seguro e otimizado para a Google GenAI API.
 * 
 * [SERVERLESS / EDGE FUNCTION CONTEXT]:
 * Este código roda na Vercel Edge Network (V8 Isolate), não no navegador nem em Node.js completo.
 * - SEM acesso ao DOM, window ou localStorage.
 * - Limites estritos de tempo de execução (Timeout).
 * - Deve ser extremamente rápido (low latency) para não estourar o orçamento de tempo da Edge Function.
 * 
 * RESPONSABILIDADE:
 * 1. Atuar como barreira de segurança para a API Key (Server-side only).
 * 2. Processar prompts de IA com o modelo mais rápido disponível para garantir resposta síncrona.
 * 3. Sanitizar entradas e saídas para o cliente.
 */

import { GoogleGenAI } from '@google/genai';

// PERFORMANCE: Define o runtime como 'edge' para inicialização instantânea (Cold Start próximo de zero).
export const config = {
  runtime: 'edge',
};

// ARQUITETURA [2024-12-22]: Adicionada interface para o corpo da requisição para melhorar a segurança de tipos.
interface AnalyzeRequestBody {
    prompt: string;
    systemInstruction: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper para enviar uma resposta de erro JSON padronizada
const createErrorResponse = (message: string, status: number, details = '') => {
    return new Response(JSON.stringify({ error: message, details }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
};

export default async function handler(req: Request) {
    // Tratamento de Preflight CORS
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return createErrorResponse('Method Not Allowed', 405);
    }

    // [2025-01-15] ROBUSTEZ: Tratamento específico para falhas de parsing JSON.
    // DO NOT REFACTOR: Isso garante que um JSON malformado retorne 400 (Bad Request) 
    // em vez de cair no catch genérico 500, o que confundiria o diagnóstico.
    let body: AnalyzeRequestBody;
    try {
        body = await req.json();
    } catch (e) {
        return createErrorResponse('Bad Request: Invalid JSON format', 400);
    }

    const { prompt, systemInstruction } = body;

    try {
        if (!prompt || !systemInstruction) {
            return createErrorResponse('Bad Request: Missing prompt or systemInstruction', 400);
        }
        
        // SECURITY CRITICAL: A API Key deve vir apenas das variáveis de ambiente do servidor.
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error("[api/analyze] API_KEY environment variable not set.");
            return createErrorResponse('Internal Server Error', 500, 'Server configuration error.');
        }
        
        const ai = new GoogleGenAI({ apiKey });

        // PERFORMANCE TUNING [2025-03-10] & ARCHITECTURAL LOCK:
        // DO NOT REFACTOR to 'pro' models without verifying Vercel Edge Function timeouts.
        // Reason: 'gemini-3-flash-preview' is chosen explicitly to guarantee execution within 
        // Edge Function limits (typically 10s-30s). Pro models are slower and risk hanging the connection.
        // Flash offers the best balance of speed/quality for analyzing large habit history text blobs.
        const geminiResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                // Thinking config removed to prioritize latency. Flash is smart enough for this reflection task.
            },
        });
        
        // MELHORIA DE ROBUSTEZ: Verifica se a resposta do modelo foi bloqueada ou está vazia.
        // A propriedade .text é um getter que pode ser undefined se o conteúdo for bloqueado.
        if (!geminiResponse.candidates || geminiResponse.candidates.length === 0 || !geminiResponse.text) {
            const finishReason = geminiResponse.candidates?.[0]?.finishReason;
            const safetyRatings = geminiResponse.promptFeedback?.safetyRatings;
            
            let details = `Generation failed.`;
            if (finishReason) {
                details += ` Finish reason: ${finishReason}.`;
            }
            if (safetyRatings) {
                details += ` Safety ratings: ${JSON.stringify(safetyRatings)}.`;
            }

            // Retorna um erro específico para bloqueio de segurança, que o cliente pode interpretar.
            if (finishReason === 'SAFETY') {
                 return createErrorResponse('Bad Request: The response was blocked due to safety concerns.', 400, details);
            }
            
            // Retorna um erro genérico para outras falhas na geração de conteúdo.
            return createErrorResponse('Internal Server Error: Failed to generate content from the model.', 500, details);
        }

        const fullText = geminiResponse.text;
        
        return new Response(fullText, {
            headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (error) {
        console.error('Critical error in /api/analyze handler:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return createErrorResponse('Internal Server Error', 500, errorMessage);
    }
}
