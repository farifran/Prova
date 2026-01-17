
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/drag.ts
 * @description Motor de Física para Drag & Drop e Auto-Scroll.
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo gerencia a interação mais custosa da UI.
 * Arrastar elementos causa recálculos de layout constantes se não for gerenciado corretamente.
 * 
 * ARQUITETURA (Read/Write Separation):
 * - Event Loop (`dragover`): Realiza APENAS cálculos matemáticos (interseção, velocidade, posição).
 *   NÃO manipula o DOM (leitura apenas).
 * - Render Loop (`requestAnimationFrame`): Aplica as mudanças visuais (transform, classes, scroll).
 *   Isso evita "Layout Thrashing" (ciclos de leitura/escrita forçados no mesmo frame).
 * 
 * OTIMIZAÇÕES CRÍTICAS:
 * 1. Geometry Caching: As posições de todos os cartões são cacheadas no `dragstart`.
 *    Durante o arrasto, usamos matemática pura em vez de `getBoundingClientRect()` (que força reflow).
 * 2. GPU Composition: O indicador de drop usa `translate3d` para mover-se na camada do compositor.
 * 3. Iterator Access: Usa `getLiveHabitCards` para iterar sobre referências em memória,
 *    evitando `querySelectorAll` lento.
 */

import { ui } from '../render/ui';
import { isCurrentlySwiping } from './swipe';
import { handleHabitDrop, reorderHabit } from '../habitActions';
// FIX: Import getEffectiveScheduleForHabitOnDate from selectors module, not state module.
import { state, TimeOfDay, Habit } from '../state';
import { getEffectiveScheduleForHabitOnDate } from '../services/selectors';
import { triggerHaptic } from '../utils';
import { DOM_SELECTORS, CSS_CLASSES } from '../render/constants';
// OPTIMIZATION [2025-03-17]: Import live card iterator to avoid querySelectorAll
import { getLiveHabitCards } from '../render/habits';

const DROP_INDICATOR_GAP = 5; 
const DROP_INDICATOR_HEIGHT = 3; 

// CALIBRAÇÃO DE FÍSICA [2025-03-04]:
// Zona de 120px. Velocidade quadrática para controle preciso.
// Curva: v = MAX * (proximidade ^ 2).
const SCROLL_ZONE_SIZE = 120;
const MAX_SCROLL_SPEED = 15; // Aumentado levemente pois a curva quadrática é mais suave na média

export function setupDragHandler(habitContainer: HTMLElement) {
    // --- STATE VARIABLES (HOT PATH) ---
    // Estas variáveis são acessadas centenas de vezes por segundo.
    let draggedElement: HTMLElement | null = null;
    let draggedHabitId: string | null = null;
    let draggedHabitOriginalTime: TimeOfDay | null = null;
    
    // OPTIMIZATION [2025-03-16]: Cache the schedule at drag start to avoid recalculating per frame.
    let cachedScheduleForDay: TimeOfDay[] | null = null;
    
    let dropIndicator: HTMLElement | null = null;
    
    // Render State Variables (Buffer entre Lógica e UI)
    let nextDropZoneTarget: HTMLElement | null = null;
    let currentRenderedDropZone: HTMLElement | null = null;
    
    // PERFORMANCE [2025-03-16]: Changed from string (px) to number for GPU transform
    let nextIndicatorY: number | null = null;
    let currentIndicatorY: number | null = null;
    
    let nextReorderTargetId: string | null = null;
    let nextReorderPosition: 'before' | 'after' | null = null;
    let isDropValid = false;

    // Variáveis de estado para Auto-Scroll
    let scrollVelocity = 0;
    let animationFrameId: number | null = null;
    
    // PERFORMANCE [2025-03-03]: Cache container bounds to avoid layout thrashing
    let cachedContainerRect: DOMRect | null = null;

    // PERFORMANCE [2025-03-12]: Geometry Cache for Habit Cards.
    // Armazena as posições iniciais (Y) e alturas para evitar chamar `getBoundingClientRect`
    // dentro do loop crítico `dragover`.
    // BUGFIX [2025-03-16]: Removed 'top' from cache because it becomes stale on scroll.
    // We only cache offset properties which are stable relative to the parent.
    const cardRectCache = new Map<string, { offsetTop: number, offsetHeight: number }>();

    /**
     * Snapshot geométrico do layout.
     * Deve ser chamado apenas UMA VEZ no início do arrasto.
     */
    function _captureGeometryCache() {
        cardRectCache.clear();
        
        // ADVANCED OPTIMIZATION [2025-03-17]: Avoid querySelectorAll(DOM_SELECTORS.HABIT_CARD).
        // Iterate over the live cache of habit cards directly from memory.
        // This is O(HABIT_COUNT) memory access vs O(DOM_NODES) traversal.
        const liveCardsIterator = getLiveHabitCards();
        
        for (const card of liveCardsIterator) {
            // Ensure card is actually in the DOM (isConnected) before reading layout
            if (card.isConnected && card.dataset.habitId && card !== draggedElement) {
                // Layout Read (Força Recalculo de Estilo se o DOM estiver sujo, mas fazemos isso apenas 1x)
                cardRectCache.set(card.dataset.habitId, {
                    offsetTop: card.offsetTop,
                    offsetHeight: card.offsetHeight
                });
            }
        }
    }

    /**
     * [MAIN THREAD] RENDER LOOP
     * Executa a cada frame (~16ms). Responsável APENAS por escritas no DOM.
     * Desacopla a física (cálculos) da pintura.
     */
    function _animationLoop() {
        // 1. Auto-Scroll (Write)
        if (scrollVelocity !== 0) {
            // Nota: O CSS 'scroll-behavior: auto' é forçado pela classe .is-dragging
            habitContainer.scrollBy(0, scrollVelocity);
        }

        // 2. Drop Zone Highlighting (Write)
        if (nextDropZoneTarget !== currentRenderedDropZone) {
            if (currentRenderedDropZone) {
                currentRenderedDropZone.classList.remove(CSS_CLASSES.DRAG_OVER, CSS_CLASSES.INVALID_DROP);
            }
            currentRenderedDropZone = nextDropZoneTarget;
        }

        if (currentRenderedDropZone) {
            const shouldBeInvalid = !isDropValid;
            const shouldBeDragOver = isDropValid && currentRenderedDropZone.dataset.time !== draggedHabitOriginalTime;

            // Dirty Checking para evitar manipulação de classe desnecessária
            if (currentRenderedDropZone.classList.contains(CSS_CLASSES.INVALID_DROP) !== shouldBeInvalid) {
                currentRenderedDropZone.classList.toggle(CSS_CLASSES.INVALID_DROP, shouldBeInvalid);
            }
            if (currentRenderedDropZone.classList.contains(CSS_CLASSES.DRAG_OVER) !== shouldBeDragOver) {
                currentRenderedDropZone.classList.toggle(CSS_CLASSES.DRAG_OVER, shouldBeDragOver);
            }
            
            // DOM Manipulation: Move o indicador para a zona correta
            if (dropIndicator && dropIndicator.parentElement !== currentRenderedDropZone) {
                currentRenderedDropZone.appendChild(dropIndicator);
                // Reset transform when changing parents to avoid visual jumps before next frame
                dropIndicator.style.transform = 'translate3d(0, 0, 0)';
            }
        } else {
             if (dropIndicator && dropIndicator.parentElement) {
                 dropIndicator.remove();
             }
        }

        // 3. Drop Indicator Positioning (Write)
        if (dropIndicator && currentRenderedDropZone) {
            if (isDropValid) {
                if (!dropIndicator.classList.contains('visible')) {
                    dropIndicator.classList.add('visible');
                }
                
                // PERFORMANCE [2025-03-16]: GPU Hardware Acceleration.
                // Uses translate3d to move the indicator on the composite layer, 
                // avoiding CPU Layout recalculations on every frame.
                if (nextIndicatorY !== currentIndicatorY && nextIndicatorY !== null) {
                    dropIndicator.style.transform = `translate3d(0, ${nextIndicatorY}px, 0)`;
                    currentIndicatorY = nextIndicatorY;
                }
                
                if (nextReorderTargetId) dropIndicator.dataset.targetId = nextReorderTargetId;
                if (nextReorderPosition) dropIndicator.dataset.position = nextReorderPosition;
            } else {
                if (dropIndicator.classList.contains('visible')) {
                    dropIndicator.classList.remove('visible');
                }
            }
        }

        animationFrameId = requestAnimationFrame(_animationLoop);
    }

    function _startAnimationLoop() {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(_animationLoop);
        }
    }

    function _stopAnimationLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        scrollVelocity = 0;
    }

    /**
     * CRITICAL LOGIC: Physics Engine (Read-Only Phase).
     * Calcula interseções, velocidade e posição do indicador.
     * NÃO deve escrever no DOM.
     */
    function _calculateDragState(e: DragEvent) {
        const target = e.target as HTMLElement;
        
        let dropZone = target.closest<HTMLElement>(DOM_SELECTORS.DROP_ZONE);
        if (!dropZone) {
            const wrapper = target.closest<HTMLElement>('.habit-group-wrapper');
            if (wrapper) {
                dropZone = wrapper.querySelector<HTMLElement>(DOM_SELECTORS.DROP_ZONE);
            }
        }
        
        const { clientY } = e;
        
        // PERFORMANCE FIX: Use cached rect instead of getBoundingClientRect().
        // Fallback to getBoundingClientRect if cache is somehow missing (safety).
        const scrollContainerRect = cachedContainerRect || habitContainer.getBoundingClientRect();
        
        const topZoneEnd = scrollContainerRect.top + SCROLL_ZONE_SIZE;
        const bottomZoneStart = scrollContainerRect.bottom - SCROLL_ZONE_SIZE;

        let potentialVelocity = 0;
        
        // --- 1. CALCULAR VELOCIDADE POTENCIAL (Curva Quadrática) ---
        if (clientY < topZoneEnd) {
            const distance = clientY - scrollContainerRect.top;
            let ratio = (SCROLL_ZONE_SIZE - distance) / SCROLL_ZONE_SIZE;
            ratio = Math.max(0, Math.min(1, ratio));
            const intensity = ratio * ratio; // Curva quadrática para suavidade
            potentialVelocity = -(intensity * MAX_SCROLL_SPEED);
            if (potentialVelocity > -1 && potentialVelocity < 0) potentialVelocity = -1;

        } else if (clientY > bottomZoneStart) {
            const distance = scrollContainerRect.bottom - clientY;
            let ratio = (SCROLL_ZONE_SIZE - distance) / SCROLL_ZONE_SIZE;
            ratio = Math.max(0, Math.min(1, ratio));
            const intensity = ratio * ratio;
            potentialVelocity = intensity * MAX_SCROLL_SPEED;
            if (potentialVelocity < 1 && potentialVelocity > 0) potentialVelocity = 1;
        }

        // --- 2. VERIFICAÇÃO DE LIMITES (PROATIVA) ---
        let finalVelocity = potentialVelocity;
        
        if (potentialVelocity < 0 && habitContainer.scrollTop <= 0) {
            finalVelocity = 0;
        } else if (potentialVelocity > 0) {
            const atScrollEnd = habitContainer.scrollTop >= (habitContainer.scrollHeight - habitContainer.clientHeight);
            
            // BUGFIX: Adiciona verificação geométrica para o último elemento.
            // Se o último grupo já estiver totalmente visível, não devemos rolar.
            const lastGroupWrapper = habitContainer.querySelector('.habit-group-wrapper:last-child');
            let isLastElementVisible = false;
            if (lastGroupWrapper) {
                const lastGroupRect = lastGroupWrapper.getBoundingClientRect();
                isLastElementVisible = lastGroupRect.bottom <= scrollContainerRect.bottom;
            }

            if (atScrollEnd || isLastElementVisible) {
                finalVelocity = 0;
            }
        }
        
        scrollVelocity = finalVelocity; // Atualiza estado para o loop de animação ler

        // --- 3. LÓGICA DE ZONA DE SOLTURA (DROP ZONE) ---
        if (!cachedScheduleForDay || !draggedHabitOriginalTime || !dropZone) {
            nextDropZoneTarget = null;
            isDropValid = false;
            return;
        }

        nextDropZoneTarget = dropZone;
        const newTime = dropZone.dataset.time as TimeOfDay;
        
        // Use cached schedule instead of expensive calculation
        const isSameGroup = newTime === draggedHabitOriginalTime;
        let isInvalidDrop = !isSameGroup && cachedScheduleForDay.includes(newTime);
    
        if (!isSameGroup && cachedScheduleForDay.length <= 1) {
            isInvalidDrop = false; 
        }
    
        isDropValid = !isInvalidDrop;

        const cardTarget = target.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        
        if (cardTarget && cardTarget !== draggedElement && cardTarget.parentElement === dropZone) {
            // FIX [2025-03-16]: Use live Geometry for hit testing to support scrolling.
            // Reading getBoundingClientRect on the *target* element is efficient enough because
            // we don't loop through all elements.
            const targetRect = cardTarget.getBoundingClientRect();
            const midY = targetRect.top + targetRect.height / 2;
            const position = e.clientY < midY ? 'before' : 'after';
            
            // OPTIMIZATION: Use cached Offset properties for Indicator Positioning (Write Phase).
            // This prevents layout thrashing by avoiding reading layout props that trigger reflow
            // right before we write to style.
            const targetId = cardTarget.dataset.habitId;
            const cachedProps = targetId ? cardRectCache.get(targetId) : null;
            
            let indicatorY: number;
            
            if (cachedProps) {
                // Fast path using cached relative offsets
                indicatorY = position === 'before'
                    ? cachedProps.offsetTop - DROP_INDICATOR_GAP
                    : cachedProps.offsetTop + cachedProps.offsetHeight + DROP_INDICATOR_GAP;
            } else {
                // Fallback path
                indicatorY = position === 'before'
                    ? cardTarget.offsetTop - DROP_INDICATOR_GAP
                    : cardTarget.offsetTop + cardTarget.offsetHeight + DROP_INDICATOR_GAP;
            }

            // Adjust for centering the indicator height
            nextIndicatorY = indicatorY - (DROP_INDICATOR_HEIGHT / 2);
            nextReorderTargetId = targetId || null;
            nextReorderPosition = position;
        } else {
            nextReorderTargetId = null;
            nextReorderPosition = null;
            nextIndicatorY = null; 
        }
    }

    function _determineAndExecuteDropAction() {
        if (!draggedHabitId || !draggedHabitOriginalTime) return;
        
        const reorderTargetId = nextReorderTargetId;
        const reorderPosition = nextReorderPosition;
        const newTime = nextDropZoneTarget?.dataset.time as TimeOfDay | undefined;

        if (!newTime || !isDropValid) return;

        const isMovingGroup = newTime !== draggedHabitOriginalTime;
        const isReordering = reorderTargetId && draggedHabitId !== reorderTargetId;

        if (isMovingGroup) {
            triggerHaptic('medium');
            handleHabitDrop(
                draggedHabitId, 
                draggedHabitOriginalTime, 
                newTime,
                isReordering && reorderTargetId ? { id: reorderTargetId, pos: reorderPosition! } : undefined
            );
        } else if (isReordering) {
            triggerHaptic('medium');
            reorderHabit(draggedHabitId, reorderTargetId!, reorderPosition!);
        }
    }

    function _resetDragState() {
        draggedElement = null;
        draggedHabitId = null;
        draggedHabitOriginalTime = null;
        cachedScheduleForDay = null; // Clear cache
        dropIndicator = null;
        
        nextDropZoneTarget = null;
        currentRenderedDropZone = null;
        nextIndicatorY = null;
        currentIndicatorY = null;
        nextReorderTargetId = null;
        nextReorderPosition = null;
        isDropValid = false;
        
        cachedContainerRect = null;
        cardRectCache.clear(); // Free memory
    }


    const handleBodyDragOver = (e: DragEvent) => {
        e.preventDefault(); 
        _calculateDragState(e);
        
        if (isDropValid) {
            e.dataTransfer!.dropEffect = 'move';
        } else {
            e.dataTransfer!.dropEffect = 'none';
        }
    };

    const handleBodyDrop = (e: DragEvent) => {
        e.preventDefault();
        _determineAndExecuteDropAction();
    };
    
    const cleanupDrag = () => {
        draggedElement?.classList.remove(CSS_CLASSES.DRAGGING);
        document.body.classList.remove('is-dragging-active');
        
        habitContainer.classList.remove('is-dragging');
        
        if (currentRenderedDropZone) {
            currentRenderedDropZone.classList.remove(CSS_CLASSES.DRAG_OVER, CSS_CLASSES.INVALID_DROP);
        }
        
        dropIndicator?.remove();
        _stopAnimationLoop();
        
        document.body.removeEventListener('dragover', handleBodyDragOver);
        document.body.removeEventListener('drop', handleBodyDrop);
        document.body.removeEventListener('dragend', cleanupDrag);

        _resetDragState();
    };

    habitContainer.addEventListener('dragstart', e => {
        if (isCurrentlySwiping()) {
            e.preventDefault();
            return;
        }
        const cardContent = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
        const card = cardContent?.closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        if (card && cardContent && card.dataset.habitId && card.dataset.time) {
            triggerHaptic('light');
            draggedElement = card;
            draggedHabitId = card.dataset.habitId;
            draggedHabitOriginalTime = card.dataset.time as TimeOfDay;
            
            const draggedHabitObject = state.habits.find(h => h.id === draggedHabitId) || null;
            if (draggedHabitObject) {
                // PERFORMANCE: Calculate and cache the schedule ONCE at drag start.
                cachedScheduleForDay = getEffectiveScheduleForHabitOnDate(draggedHabitObject, state.selectedDate);
            }
            
            // CACHE HIT: Cache the container rect to avoid repeated layout reads during dragover.
            cachedContainerRect = habitContainer.getBoundingClientRect();
            // OPTIMIZATION: Pre-calculate layout once
            _captureGeometryCache();

            e.dataTransfer!.setData('text/plain', draggedHabitId);
            e.dataTransfer!.effectAllowed = 'move';

            const dragImage = cardContent.cloneNode(true) as HTMLElement;
            dragImage.classList.add(CSS_CLASSES.DRAG_IMAGE_GHOST);
            
            const computedStyle = window.getComputedStyle(cardContent);
            dragImage.style.width = `${cardContent.offsetWidth}px`;
            dragImage.style.height = `${cardContent.offsetHeight}px`;
            dragImage.style.backgroundColor = computedStyle.backgroundColor;
            dragImage.style.borderRadius = computedStyle.borderRadius;
            dragImage.style.color = computedStyle.color;

            document.body.appendChild(dragImage);
            e.dataTransfer!.setDragImage(dragImage, e.offsetX, e.offsetY);
            setTimeout(() => document.body.removeChild(dragImage), 0);
            
            dropIndicator = document.createElement('div');
            dropIndicator.className = 'drop-indicator';
            // Initial position at 0,0 to prepare for transform
            dropIndicator.style.top = '0';
            dropIndicator.style.left = 'var(--space-sm)'; // Matches CSS
            dropIndicator.style.right = 'var(--space-sm)'; // Matches CSS
            
            document.body.addEventListener('dragover', handleBodyDragOver);
            document.body.addEventListener('drop', handleBodyDrop);
            document.body.addEventListener('dragend', cleanupDrag, { once: true });

            _startAnimationLoop();

            setTimeout(() => {
                document.body.classList.add('is-dragging-active');
                card.classList.add(CSS_CLASSES.DRAGGING);
                habitContainer.classList.add('is-dragging');
            }, 0);
        }
    });
}
