/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners/swipe.ts
 * @description Motor de Física para Gestos de Deslize (Swipe Actions).
 * 
 * [MAIN THREAD CONTEXT]:
 * Lida com gestos horizontais para revelar ações secundárias (Apagar/Notas).
 */

import { triggerHaptic } from '../utils';
import { DOM_SELECTORS, CSS_CLASSES } from '../render/constants';

let isSwiping = false;
// PERFORMANCE: Cache global para evitar leitura de estilos computados (lento) a cada gesto.
let cachedSwipeActionWidth = 60; // Default fallback

const SWIPE_INTENT_THRESHOLD = 10;

export const isCurrentlySwiping = (): boolean => isSwiping;

/**
 * Decide se o cartão deve "encaixar" (snap) aberto ou fechado ao final do gesto.
 */
function _finalizeSwipeState(activeCard: HTMLElement, currentTranslateX: number) {
    const threshold = cachedSwipeActionWidth * 0.5;
    
    // Determine target state
    let targetState: 'closed' | 'left' | 'right' = 'closed';

    if (currentTranslateX > threshold) {
        targetState = 'left';
    } else if (currentTranslateX < -threshold) {
        targetState = 'right';
    }

    // Reset styles to let CSS handle the transition to the final state
    const contentWrapper = activeCard.querySelector<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
    if (contentWrapper) {
        contentWrapper.style.transform = '';
    }

    // Apply classes based on target state
    activeCard.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT);
    
    if (targetState === 'left') {
        activeCard.classList.add(CSS_CLASSES.IS_OPEN_LEFT);
        triggerHaptic('medium');
    } else if (targetState === 'right') {
        activeCard.classList.add(CSS_CLASSES.IS_OPEN_RIGHT);
        triggerHaptic('medium');
    }
}

/**
 * CRITICAL LOGIC: Event Suppression.
 * Se o usuário arrastou o cartão, o evento 'click' subsequente (disparado ao soltar)
 * deve ser interceptado para não ativar a ação de clique do cartão (toggle status).
 * Usa a fase de captura (true) para interceptar antes que chegue aos listeners do cartão.
 */
function _blockSubsequentClick() {
    const captureClick = (e: Event) => {
        e.stopPropagation();
        e.preventDefault();
    };
    // Adiciona listener na fase de captura que se auto-remove
    window.addEventListener('click', captureClick, { capture: true, once: true });
    // Remove after a short timeout in case click doesn't happen immediately
    setTimeout(() => {
        window.removeEventListener('click', captureClick, { capture: true });
    }, 100);
}

// PERFORMANCE: Lê o CSS apenas quando necessário (resize), evitando Forced Reflows no hot path.
function updateCachedLayoutValues() {
    // Only access DOM if available
    if (typeof document !== 'undefined') {
        const rootStyles = getComputedStyle(document.documentElement);
        // BUGFIX: Fallback seguro para 60 se parseInt falhar (NaN).
        cachedSwipeActionWidth = parseInt(rootStyles.getPropertyValue('--swipe-action-width'), 10) || 60;
    }
}

export function setupSwipeHandler(habitContainer: HTMLElement) {
    // Initialize layout cache
    updateCachedLayoutValues();
    window.addEventListener('resize', updateCachedLayoutValues);

    let activeCard: HTMLElement | null = null;
    let contentWrapper: HTMLElement | null = null;
    
    let startX = 0;
    let startY = 0;
    let initialTranslateX = 0;
    
    // Gestures flags
    let isHorizontalGesture = false;
    let isVerticalGesture = false;

    const onPointerDown = (e: PointerEvent) => {
        // Ignore interaction if clicking directly on a button (like delete/note buttons exposed)
        if ((e.target as HTMLElement).closest('button')) return;

        const card = (e.target as HTMLElement).closest<HTMLElement>(DOM_SELECTORS.HABIT_CARD);
        if (!card) return;

        // Auto-close other cards
        const allOpen = habitContainer.querySelectorAll(`.${CSS_CLASSES.IS_OPEN_LEFT}, .${CSS_CLASSES.IS_OPEN_RIGHT}`);
        allOpen.forEach(c => {
            if (c !== card) c.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT);
        });

        activeCard = card;
        contentWrapper = card.querySelector<HTMLElement>(DOM_SELECTORS.HABIT_CONTENT_WRAPPER);
        
        if (!contentWrapper) return;

        startX = e.clientX;
        startY = e.clientY;
        isHorizontalGesture = false;
        isVerticalGesture = false;
        isSwiping = false;

        // Calculate initial offset if card is already open
        initialTranslateX = 0;
        if (card.classList.contains(CSS_CLASSES.IS_OPEN_LEFT)) initialTranslateX = cachedSwipeActionWidth;
        if (card.classList.contains(CSS_CLASSES.IS_OPEN_RIGHT)) initialTranslateX = -cachedSwipeActionWidth;

        // Disable CSS transition during manual drag for 1:1 responsiveness
        contentWrapper.style.transition = 'none';

        activeCard.setPointerCapture(e.pointerId);
        activeCard.addEventListener('pointermove', onPointerMove);
        activeCard.addEventListener('pointerup', onPointerUp);
        activeCard.addEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
        if (!activeCard || !contentWrapper) return;

        // Lock vertical scrolling if we are swiping
        if (isHorizontalGesture) {
            e.preventDefault(); // Prevent scroll
        }

        if (isVerticalGesture) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        // Detect intent
        if (!isHorizontalGesture) {
            if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > SWIPE_INTENT_THRESHOLD) {
                isVerticalGesture = true;
                // Release capture to let browser handle scroll
                if (activeCard.hasPointerCapture(e.pointerId)) {
                    activeCard.releasePointerCapture(e.pointerId);
                }
                return;
            }

            if (Math.abs(deltaX) > SWIPE_INTENT_THRESHOLD) {
                isHorizontalGesture = true;
                isSwiping = true;
                activeCard.classList.add(CSS_CLASSES.IS_SWIPING);
            } else {
                // Not enough movement yet
                return;
            }
        }

        // Apply Physics (Elastic Band)
        let newTranslate = initialTranslateX + deltaX;
        
        // Limits
        // Logarithmic resistance
        if (newTranslate > cachedSwipeActionWidth) {
            const over = newTranslate - cachedSwipeActionWidth;
            newTranslate = cachedSwipeActionWidth + (over * 0.3);
        } else if (newTranslate < -cachedSwipeActionWidth) {
            const over = newTranslate - (-cachedSwipeActionWidth);
            newTranslate = -cachedSwipeActionWidth + (over * 0.3);
        }

        contentWrapper.style.transform = `translateX(${newTranslate}px)`;
    };

    const onPointerUp = (e: PointerEvent) => {
        if (!activeCard || !contentWrapper) return;

        // Cleanup events
        activeCard.removeEventListener('pointermove', onPointerMove);
        activeCard.removeEventListener('pointerup', onPointerUp);
        activeCard.removeEventListener('pointercancel', onPointerUp);
        
        // Restore CSS transition
        contentWrapper.style.transition = '';
        activeCard.classList.remove(CSS_CLASSES.IS_SWIPING);

        if (isHorizontalGesture) {
            const deltaX = e.clientX - startX;
            const finalTranslate = initialTranslateX + deltaX;
            
            _finalizeSwipeState(activeCard, finalTranslate);
            
            // Suppress click
            _blockSubsequentClick();
        } else {
            // Was a tap or vertical scroll, just reset
            contentWrapper.style.transform = '';
            // If it was just a tap, we might need to toggle open state if it was open?
            // Usually tapping an open card closes it.
            if (Math.abs(e.clientX - startX) < 5 && Math.abs(e.clientY - startY) < 5) {
                if (activeCard.classList.contains(CSS_CLASSES.IS_OPEN_LEFT) || activeCard.classList.contains(CSS_CLASSES.IS_OPEN_RIGHT)) {
                    activeCard.classList.remove(CSS_CLASSES.IS_OPEN_LEFT, CSS_CLASSES.IS_OPEN_RIGHT);
                    _blockSubsequentClick(); // Prevent the click from triggering the "check" action
                }
            }
        }

        isSwiping = false;
        isHorizontalGesture = false;
        isVerticalGesture = false;
        activeCard = null;
        contentWrapper = null;
    };

    habitContainer.addEventListener('pointerdown', onPointerDown);
}