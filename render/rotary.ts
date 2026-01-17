
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/rotary.ts
 * @description Componente de Interface "Reel Rotary" (Seletor Giratório/Carrossel).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia interações de toque e mouse de alta frequência (gestos).
 * Deve manter 60fps cravados durante o arrasto ("scrubbing").
 * 
 * ARQUITETURA (Physics-based UI):
 * - **Responsabilidade Única:** Encapsular a lógica de física, gestos e renderização do seletor circular.
 * - **Geometry Caching:** Utiliza `ResizeObserver` para monitorar dimensões sem causar "Layout Thrashing"
 *   (leituras síncronas de DOM) dentro do loop de eventos `pointermove`.
 * - **Pointer Events API:** Uso robusto de `setPointerCapture` para garantir que o gesto continue
 *   mesmo se o dedo sair da área do elemento.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **CSS Transforms:** Movimentação via `translateX` para garantir composição na GPU.
 * 2. **Loopless Navigation:** A lógica de botões implementa aritmética modular para navegação cíclica infinita.
 * 3. **Interrupção de Animação:** Ao iniciar um toque, lê a matriz de transformação atual para permitir
 *    "pegar" o carrossel no meio de uma animação (seamless interruption).
 */

interface RotaryConfig {
    viewportEl: HTMLElement;
    reelEl: HTMLElement;
    prevBtn: HTMLButtonElement;
    nextBtn: HTMLButtonElement;
    optionsCount: number;
    getInitialIndex: () => number;
    onIndexChange: (index: number) => Promise<void> | void;
    render: () => void;
}

export function setupReelRotary({
    viewportEl,
    reelEl,
    prevBtn,
    nextBtn,
    optionsCount,
    getInitialIndex,
    onIndexChange,
    render,
}: RotaryConfig) {

    let currentIndex = getInitialIndex();
    
    const handleIndexChange = async (direction: 'next' | 'prev') => {
        let nextIndex;
        // OTIMIZAÇÃO UX: A lógica de botões permite "dar a volta" (loop infinito),
        // o que é um padrão aceitável para botões de navegação, diferente do swipe linear.
        // DO NOT REFACTOR: A aritmética modular lida corretamente com índices negativos em JS?
        // JS `%` operator pode retornar negativo, então somamos `optionsCount` antes do módulo no 'prev'.
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % optionsCount;
        } else {
            nextIndex = (currentIndex - 1 + optionsCount) % optionsCount;
        }
        await onIndexChange(nextIndex);
        currentIndex = getInitialIndex(); // Re-sincroniza caso o estado tenha sido atualizado externamente
        render(); // Garante que a UI seja redesenhada e alinhada após a mudança.
    };

    prevBtn.addEventListener('click', () => handleIndexChange('prev'));
    nextBtn.addEventListener('click', () => handleIndexChange('next'));

    viewportEl.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') handleIndexChange('next');
        else if (e.key === 'ArrowLeft') handleIndexChange('prev');
    });

    // Variáveis de estado para o gesto de swipe
    let startX = 0;
    let isSwiping = false;
    let startTransformX = 0;
    
    // PERFORMANCE [2025-02-23]: Cache da largura do item via ResizeObserver.
    // Evita leituras síncronas de layout (clientWidth) durante eventos de interação (Hot Path).
    // Ler o DOM dentro de `pointermove` causaria Recalculate Style forçado a cada frame.
    let cachedItemWidth = 95; // Valor inicial seguro
    
    const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            // Assume que todos os filhos têm a mesma largura. Pega o primeiro para referência.
            const firstChild = entry.target.firstElementChild;
            if (firstChild) {
                cachedItemWidth = firstChild.clientWidth;
            }
        }
    });
    
    // Observa o reel para capturar mudanças de layout nos filhos (ex: troca de idioma ou redimensionamento da janela)
    resizeObserver.observe(reelEl);
    
    const SWIPE_THRESHOLD = 40;

    /**
     * [MAIN THREAD HOT PATH]: Executado a cada movimento do ponteiro (~120Hz).
     * Deve ser zero-allocation e zero-layout-read.
     */
    const pointerMove = (e: PointerEvent) => {
        if (!isSwiping) return;
        
        // UX CRÍTICA: Previne que o navegador interprete o gesto como rolagem de página ou navegação "voltar".
        // Essencial para a sensação de app nativo em mobile.
        e.preventDefault();
        
        const diffX = e.clientX - startX;
        
        // PERFORMANCE: Usa o valor cacheado (cachedItemWidth) em vez de consultar o DOM.
        const newTranslateX = startTransformX + diffX;
        
        // Clamping (Limites): Impede arrastar muito além do primeiro ou último item
        const minTranslateX = -(optionsCount - 1) * cachedItemWidth;
        // Permite um leve "over-drag" elástico (opcional, aqui mantemos hard limit para simplicidade)
        const clampedTranslateX = Math.max(minTranslateX, Math.min(0, newTranslateX));
        
        // GPU COMPOSITION: Escreve diretamente no estilo transform.
        reelEl.style.transform = `translateX(${clampedTranslateX}px)`;
    };

    const endSwipe = (e: PointerEvent) => {
        // Limpeza de listeners globais
        window.removeEventListener('pointermove', pointerMove);
        window.removeEventListener('pointerup', pointerUp);
        window.removeEventListener('pointercancel', endSwipe);
        
        if (!isSwiping) return;
        isSwiping = false;
        
        // UX: Libera a captura do ponteiro para permitir interações normais subsequentes
        try {
            if (viewportEl.hasPointerCapture(e.pointerId)) {
                viewportEl.releasePointerCapture(e.pointerId);
            }
        } catch (err) {
            // Ignora erros se o ponteiro já foi perdido (ex: alt-tab)
        }
        
        // Restaura a transição CSS para o efeito de "snap" (o render() recalculará a posição final)
        // Usa requestAnimationFrame para garantir que a transição seja aplicada no próximo frame de pintura.
        requestAnimationFrame(() => {
            reelEl.style.transition = '';
        });

        currentIndex = getInitialIndex();
        render(); // Snap to grid
    };

    const pointerUp = async (e: PointerEvent) => {
        if (!isSwiping) return;
        
        const diffX = e.clientX - startX;
        
        // Lógica de limiar para decidir se muda o índice
        if (Math.abs(diffX) > SWIPE_THRESHOLD) {
            if (diffX < 0) { // Deslize para a esquerda (Próximo Item)
                await onIndexChange((currentIndex + 1) % optionsCount);
            } else { // Deslize para a direita (Item Anterior)
                await onIndexChange((currentIndex - 1 + optionsCount) % optionsCount);
            }
        }
        
        endSwipe(e);
    };

    viewportEl.addEventListener('pointerdown', (e: PointerEvent) => {
        if (e.button !== 0) return; // Apenas botão esquerdo/toque principal

        // Estado inicial
        startX = e.clientX;
        isSwiping = true;
        currentIndex = getInitialIndex();
        
        // UX CRÍTICA: Pointer Capture.
        // Garante que os eventos de movimento continuem sendo enviados para este elemento
        // mesmo se o dedo/mouse sair da área do elemento.
        viewportEl.setPointerCapture(e.pointerId);

        // Lê a posição atual da transformação para iniciar o arrasto relativo a ela.
        // Isso permite "agarrar" o carrossel enquanto ele ainda está se movendo (interrupção de animação).
        const style = window.getComputedStyle(reelEl);
        const matrix = new DOMMatrix(style.transform);
        startTransformX = matrix.m41; // Componente X da matriz 2D
        
        // Desativa transição CSS para movimento direto e responsivo (1:1 com o dedo)
        reelEl.style.transition = 'none';
        
        // Adiciona listeners à janela para capturar movimentos fora do elemento (backup de segurança)
        // passive: false é necessário para que preventDefault funcione no touchmove (embora pointer events gerenciem isso melhor hoje em dia).
        window.addEventListener('pointermove', pointerMove, { passive: false }); 
        window.addEventListener('pointerup', pointerUp);
        window.addEventListener('pointercancel', endSwipe);
    });
}
