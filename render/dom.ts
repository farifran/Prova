
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/dom.ts
 * @description Abstrações de Baixo Nível para Manipulação do DOM (DOM Utils).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo contém funções utilitárias invocadas frequentemente (Hot Paths) pelo motor de renderização.
 * 
 * ARQUITETURA (Micro-Optimizations):
 * - **Responsabilidade Única:** Prover métodos seguros e performáticos para escrita no DOM.
 * - **Layout Thrashing Prevention:** Implementa padrões de "Dirty Checking" (Ler antes de Escrever)
 *   para evitar invalidação desnecessária da árvore de renderização do navegador.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **Direct Node Access:** Prefere `firstChild.nodeValue` sobre `textContent` para atualizações de texto
 *    atômicas, evitando o custo de parsing HTML ou recomposição de layout de elementos filhos.
 */

import { t } from '../i18n';

/**
 * OTIMIZAÇÃO DE PERFORMANCE: Helper para atualizar texto do DOM.
 * Verifica primeiro se é um TextNode simples para usar `nodeValue` (mais rápido),
 * caso contrário usa `textContent`, sempre evitando escritas desnecessárias (layout thrashing).
 * 
 * @param element O elemento alvo.
 * @param text O novo texto a ser inserido.
 */
export function setTextContent(element: Element | null, text: string) {
    if (!element) return;

    // PERFORMANCE: Fast path para TextNodes.
    // Se o elemento contém apenas um nó de texto simples, atualiza o valor do nó diretamente via `nodeValue`.
    // Isso é mais performático que .textContent porque pula passos de normalização do DOM e parsing interno.
    if (element.firstChild && element.firstChild.nodeType === 3 && !element.firstChild.nextSibling) {
        // DIRTY CHECK: Só escreve se o valor mudou.
        if (element.firstChild.nodeValue !== text) {
            element.firstChild.nodeValue = text;
        }
    } else {
        // Fallback seguro ou para elementos com estrutura mista/vazia.
        // Ainda assim, verifica antes de escrever.
        if (element.textContent !== text) {
            element.textContent = text;
        }
    }
}

/**
 * Atualiza os atributos ARIA para o componente 'Reel Rotary' (Carrossel).
 * Centraliza a lógica de acessibilidade para este componente complexo.
 */
export function updateReelRotaryARIA(viewportEl: HTMLElement, currentIndex: number, options: readonly string[] | string[], labelKey: string) {
    if (!viewportEl) return;
    
    // DOM WRITE: Batch de atributos. 
    // Em navegadores modernos, setar atributos consecutivamente geralmente agrupa os recálculos de estilo.
    viewportEl.setAttribute('role', 'slider');
    viewportEl.setAttribute('aria-label', t(labelKey));
    viewportEl.setAttribute('aria-valuemin', '1');
    viewportEl.setAttribute('aria-valuemax', String(options.length));
    viewportEl.setAttribute('aria-valuenow', String(currentIndex + 1));
    
    // A11Y FIX [2025-03-08]: Guard against undefined index access to prevent "undefined" string in ARIA.
    // Garante que leitores de tela não anunciem "undefined".
    viewportEl.setAttribute('aria-valuetext', options[currentIndex] || '');
    
    viewportEl.setAttribute('tabindex', '0');
}
