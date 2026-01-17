/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file listeners.ts
 * @description Ponto de Entrada para Inicialização de Eventos (Event Bootstrapper).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo roda na thread principal e deve ser executado apenas UMA VEZ na inicialização (Singleton initialization).
 * 
 * ARQUITETURA:
 * - Padrão "Facade": Centraliza a chamada de inicializadores espalhados por domínios (Modais, Cards, Gestos).
 * - Injeção de Dependência Leve: Passa referências de DOM cacheadas (`ui.habitContainer`) para os handlers 
 *   de gestos para evitar querySelectors repetitivos em módulos filhos.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `render/ui.ts`: Fonte da verdade para elementos DOM (evita re-query).
 * - `listeners/*.ts`: Implementações especializadas de eventos.
 * 
 * DECISÃO TÉCNICA (Event Bus):
 * - O listener 'render-app' é a espinha dorsal da reatividade desacoplada.
 * - Permite que a camada de Lógica (`habitActions.ts`) solicite renderizações sem importar 
 *   diretamente a camada de View (`render.ts`), quebrando dependências circulares estritas.
 */

// [NOTA COMPARATIVA]: Este arquivo atua como o 'Controlador de Eventos'. Arquiteturalmente limpo, atua como um despachante (Dispatcher) delegando implementações para a pasta 'listeners/'.

import { ui } from './render/ui';
import { renderApp, renderAINotificationState } from './render';
import { setupModalListeners } from './listeners/modals';
import { setupCardListeners } from './listeners/cards';
import { setupDragHandler } from './listeners/drag';
import { setupSwipeHandler } from './listeners/swipe';
import { setupCalendarListeners } from './listeners/calendar';
import { initChartInteractions } from './render/chart';

function handleOnlineStatusChange() {
    document.body.classList.toggle('is-offline', !navigator.onLine);
    renderAINotificationState();
}

export function setupEventListeners() {
    // Inicializa módulos de listeners especializados
    setupModalListeners();
    setupCardListeners();
    setupCalendarListeners();
    initChartInteractions(); // Adiciona a inicialização do gráfico
    
    // Inicializa manipuladores de gestos complexos (Física de Drag & Swipe)
    // PERFORMANCE: Passamos o elemento cacheado `ui.habitContainer` para evitar que os 
    // módulos de gestos precisem fazer `document.querySelector` durante a inicialização.
    setupDragHandler(ui.habitContainer);
    setupSwipeHandler(ui.habitContainer);

    // CRITICAL LOGIC: Application Event Bus.
    // Event listener bus for application-wide re-renders (breaks circular dependencies).
    // DO NOT REFACTOR: Substituir isso por uma importação direta em `habitActions` causará
    // ciclos de dependência (Render -> State -> Actions -> Render).
    document.addEventListener('render-app', () => renderApp());

    // Listeners para status de conexão
    window.addEventListener('online', handleOnlineStatusChange);
    window.addEventListener('offline', handleOnlineStatusChange);
    handleOnlineStatusChange(); // Define o estado inicial
}