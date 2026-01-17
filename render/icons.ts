
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/icons.ts
 * @description Helpers de Interface para Ícones (View Helpers).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este arquivo importa os dados brutos de `data/icons.ts` e fornece funções utilitárias
 * para seleção de ícones baseada em estado (TimeOfDay).
 * 
 * ARQUITETURA:
 * - **Facade Pattern:** Re-exporta `HABIT_ICONS` e `UI_ICONS` para que o restante da UI
 *   não precise importar diretamente da camada de dados, mantendo o acoplamento baixo.
 * - **Lógica de Apresentação:** `getTimeOfDayIcon` decide qual ícone mostrar.
 * 
 * DEPENDÊNCIAS:
 * - `data/icons.ts`: Fonte da verdade das strings SVG.
 */

import type { TimeOfDay } from '../state';
import { UI_ICONS } from '../data/icons';

// Re-exporta para manter compatibilidade com módulos de renderização
export * from '../data/icons';

export function getTimeOfDayIcon(time: TimeOfDay): string {
    switch(time) {
        case 'Morning': return UI_ICONS.morning;
        case 'Afternoon': return UI_ICONS.afternoon;
        case 'Evening': return UI_ICONS.evening;
        // FALLBACK DE SEGURANÇA [2025-02-23]: Garante que a função sempre retorne uma string válida,
        // mesmo se o valor de 'time' for inválido em tempo de execução (dados corrompidos).
        default: return UI_ICONS.morning;
    }
}
