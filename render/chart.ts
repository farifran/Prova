
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

/**
 * @file render/chart.ts
 * @description Motor de Renderização de Gráficos SVG (Evolução de Hábitos).
 * 
 * [MAIN THREAD CONTEXT]:
 * Este módulo roda na thread principal e manipula o DOM (SVG) diretamente.
 * Deve manter 60fps durante interações (tooltip) e minimizar o tempo de bloqueio durante atualizações de dados.
 * 
 * ARQUITETURA (SVG & Geometry Caching):
 * - **Responsabilidade Única:** Visualizar a consistência dos hábitos nos últimos 30 dias (Pontuação Composta).
 * - **Zero Allocations (Render Loop):** Utiliza Object Pooling para os pontos de dados e Memoization 
 *   para evitar recálculos matemáticos se os dados não mudaram.
 * - **Lazy Layout:** Medições de geometria (getBoundingClientRect) são cacheadas e invalidadas apenas no resize,
 *   evitando "Layout Thrashing" durante a interação do mouse.
 * 
 * DEPENDÊNCIAS CRÍTICAS:
 * - `state.ts`: Fonte da verdade dos dados.
 * - `selectors.ts`: Lógica de cálculo de estatísticas diárias.
 * - `ui.ts`: Referências aos elementos SVG no DOM.
 * 
 * DECISÕES TÉCNICAS:
 * 1. **SVG vs Canvas:** Optou-se por SVG para garantir nitidez em qualquer resolução (Retina) e acessibilidade,
 *    já que a complexidade do gráfico (30 pontos) é baixa o suficiente para não gargalar o DOM.
 * 2. **QuadTree Implícita:** A detecção de hover usa matemática simples (eixo X) baseada na geometria cacheada,
 *    em vez de event listeners em cada ponto ou `document.elementFromPoint`.
 */

import { state, isChartDataDirty } from '../state';
import { calculateDaySummary } from '../services/selectors';
import { ui } from './ui';
import { t } from '../i18n';
import { addDays, getTodayUTCIso, parseUTCIsoDate, toUTCIsoDateString, getDateTimeFormat } from '../utils';

const CHART_DAYS = 30;
const INITIAL_SCORE = 100;
// PHYSICS ADJUSTMENT [2025-03-22]: Increased from 0.015 to 0.025 to make movements more significant visually.
// 2 consecutive days = ~5% growth (approx 60% of visual range in typical zoom).
// 3 consecutive days = ~7.6% growth (approx 80-90% of visual range).
const MAX_DAILY_CHANGE_RATE = 0.025; 
const PLUS_BONUS_MULTIPLIER = 1.5; // "Plus" days move the needle 50% more than normal days.

// VISUAL CONSTANTS
// VISUAL UPDATE [2025-03-22]: Reduced height by 5px.
const SVG_HEIGHT = 80; 
// Remove top padding completely to hit the "Askesis" line height ceiling.
const CHART_PADDING = { top: 0, right: 3, bottom: 5, left: 3 };

type ChartDataPoint = {
    date: string;
    timestamp: number; // PERFORMANCE [2025-03-09]: Pre-calculated timestamp for tooltips
    value: number;
    completedCount: number;
    scheduledCount: number;
};

type ChartScales = {
    xScale: (index: number) => number;
    yScale: (value: number) => number;
};

// --- OBJECT POOL (PERFORMANCE) ---
// Pre-allocate objects once to avoid Garbage Collection pressure during high-frequency updates.
// PERFORMANCE: Evita alocação de 30 objetos a cada renderização. O array é fixo e reciclado.
const chartDataPool: ChartDataPoint[] = Array.from({ length: CHART_DAYS }, () => ({
    date: '',
    timestamp: 0,
    value: 0,
    completedCount: 0,
    scheduledCount: 0,
}));
let lastChartData: ChartDataPoint[] = [];

// Cache de metadados para escala (Performance)
let chartMetadata = { minVal: 0, maxVal: 100, valueRange: 100 };

// Cache de geometria do gráfico (Evita Reflow no hot-path)
// CRITICAL LOGIC: A leitura de geometria síncrona força o navegador a recalcular o layout.
// Armazenamos isso para ler apenas quando necessário (resize/init).
let cachedChartRect: DOMRect | null = null;
// PERFORMANCE [2025-03-09]: Cache chart width to avoid measuring DOM on every data update
let currentChartWidth = 0;

// MEMOIZATION STATE [2025-03-18]: Tracks what was last painted to the DOM to avoid redundant work.
// DO NOT REFACTOR: Garante que _updateChartDOM aborte cedo se a referência de dados e largura forem idênticas.
let renderedDataRef: ChartDataPoint[] | null = null;
let renderedWidth = 0;

// BUGFIX: Módulo-scoped para permitir reset externo quando os dados mudam
let lastRenderedPointIndex = -1;

// Controle de visibilidade e observadores
let isChartVisible = true;
let isChartDirty = false;
let chartObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

// INTERACTION STATE [2025-02-02]: Hoisted to module scope to allow external re-render triggers.
let rafId: number | null = null;
let inputClientX = 0;


function calculateChartData(): ChartDataPoint[] {
    const endDate = parseUTCIsoDate(state.selectedDate);
    // OPTIMIZATION: Reuse iterator object instead of creating new Dates inside loop where possible,
    // though here we need specific timestamps.
    const iteratorDate = addDays(endDate, -(CHART_DAYS - 1));
    const todayISO = getTodayUTCIso();

    let previousDayValue = INITIAL_SCORE;

    // PERFORMANCE: Loop manual sobre o pool pré-alocado.
    // Evita .map() que criaria novos arrays e objetos.
    for (let i = 0; i < CHART_DAYS; i++) {
        const currentDateISO = toUTCIsoDateString(iteratorDate);
        // OPTIMIZATION [2025-03-13]: Pass iteratorDate object to avoid re-parsing inside selectors.
        // LOGIC UPDATE: Destructure 'showPlusIndicator' to detect overachievement.
        const { total: scheduledCount, completed: completedCount, pending: pendingCount, showPlusIndicator } = calculateDaySummary(currentDateISO, iteratorDate);
        const hasPending = pendingCount > 0;
        const isToday = currentDateISO === todayISO;
        const isFuture = currentDateISO > todayISO;

        let currentValue: number;
        
        if (isFuture || (isToday && hasPending)) {
            currentValue = previousDayValue;
        } else if (scheduledCount > 0) {
            const completionRatio = completedCount / scheduledCount;
            // Base performance factor: -1.0 (0%) to 1.0 (100%)
            let performanceFactor = (completionRatio - 0.5) * 2;
            
            // PHYSICS UPDATE [2025-03-22]: "Plus" days get a turbo boost.
            // This ensures they represent a significant peak in the chart.
            if (showPlusIndicator) {
                performanceFactor = 1.0 * PLUS_BONUS_MULTIPLIER;
            }

            const dailyChange = performanceFactor * MAX_DAILY_CHANGE_RATE;
            currentValue = previousDayValue * (1 + dailyChange);
        } else {
            currentValue = previousDayValue;
        }
        
        // OBJECT POOLING: Update existing object instead of creating a new one
        const point = chartDataPool[i];
        point.date = currentDateISO;
        point.timestamp = iteratorDate.getTime();
        point.value = currentValue;
        point.completedCount = completedCount;
        point.scheduledCount = scheduledCount;

        previousDayValue = currentValue;
        
        iteratorDate.setUTCDate(iteratorDate.getUTCDate() + 1);
    }
    // Return the reference to the pool
    return chartDataPool;
}

function _calculateChartScales(chartData: ChartDataPoint[], chartWidthPx: number): ChartScales {
    const padding = CHART_PADDING;
    const chartWidth = chartWidthPx - padding.left - padding.right;
    const chartHeight = SVG_HEIGHT - padding.top - padding.bottom;

    // PERFORMANCE [2025-03-16]: Check if viewBox actually changed before setting attribute.
    // Setting attribute forces browser layout invalidation even if value is identical.
    const newViewBox = `0 0 ${chartWidthPx} ${SVG_HEIGHT}`;
    if (ui.chart.svg.getAttribute('viewBox') !== newViewBox) {
        ui.chart.svg.setAttribute('viewBox', newViewBox);
    }

    // VISUAL FIX [2025-03-22]: Escala Dinâmica (Dynamic Scaling) Ajustada.
    // O objetivo é maximizar o uso vertical do gráfico para tornar as variações mais visíveis.
    let dataMin = Infinity;
    let dataMax = -Infinity;
    
    // Passada única para encontrar min/max
    for (let i = 0; i < chartData.length; i++) {
        const val = chartData[i].value;
        if (val < dataMin) dataMin = val;
        if (val > dataMax) dataMax = val;
    }

    // Define uma amplitude mínima para evitar ruído excessivo em linhas quase planas (ex: 100.00 vs 100.01)
    const MIN_VISUAL_AMPLITUDE = 2.0; 
    let spread = dataMax - dataMin;

    if (spread < MIN_VISUAL_AMPLITUDE) {
        const center = (dataMin + dataMax) / 2;
        dataMin = center - (MIN_VISUAL_AMPLITUDE / 2);
        dataMax = center + (MIN_VISUAL_AMPLITUDE / 2);
        spread = MIN_VISUAL_AMPLITUDE;
    }

    // SCALING UPDATE [2025-03-22]: Maximum Height Usage.
    // Top padding is effectively zero (via CHART_PADDING), allowing peaks to hit the ceiling.
    const verticalPaddingTop = 0; // Absolute max limit
    const verticalPaddingBottom = spread * 0.15; // 15% breathing room at bottom
    
    const minVal = dataMin - verticalPaddingBottom;
    const maxVal = dataMax + verticalPaddingTop;

    const valueRange = maxVal - minVal;
    
    chartMetadata = { minVal, maxVal, valueRange: valueRange > 0 ? valueRange : 1 };

    const xScale = (index: number) => padding.left + (index / (chartData.length - 1)) * chartWidth;
    const yScale = (value: number) => padding.top + chartHeight - ((value - minVal) / chartMetadata.valueRange) * chartHeight;

    return { xScale, yScale };
}

function _generatePathData(chartData: ChartDataPoint[], { xScale, yScale }: ChartScales): { areaPathData: string, linePathData: string } {
    // PERFORMANCE [2025-03-14]: Use specialized join for large arrays if needed, but standard map/join is fast enough here.
    const linePathData = chartData.map((point, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(point.value)}`).join(' ');
    // A área deve fechar no eixo inferior do gráfico (base da escala)
    const areaPathData = `${linePathData} V ${yScale(chartMetadata.minVal)} L ${xScale(0)} ${yScale(chartMetadata.minVal)} Z`;
    return { areaPathData, linePathData };
}

function _updateAxisLabels(chartData: ChartDataPoint[]) {
    const { axisStart, axisEnd } = ui.chart;
    // PERFORMANCE: Use stored timestamps instead of parsing ISO strings
    const firstDateMs = chartData[0].timestamp;
    const lastDateMs = chartData[chartData.length - 1].timestamp;

    const currentYear = new Date().getUTCFullYear();
    // Helper simple date extraction to avoid full Date parsing for year check
    const firstYear = new Date(firstDateMs).getUTCFullYear();
    const lastYear = new Date(lastDateMs).getUTCFullYear();
    
    const showYear = firstYear !== lastYear || lastYear !== currentYear;
    
    // PERFORMANCE: Cacheado internamente em `utils.ts`
    const axisFormatter = getDateTimeFormat(state.activeLanguageCode, { 
        month: 'short', 
        day: 'numeric', 
        timeZone: 'UTC',
        year: showYear ? '2-digit' : undefined
    });

    // DOM WRITE: Batch updates
    setTextContent(axisStart, axisFormatter.format(firstDateMs));
    setTextContent(axisEnd, axisFormatter.format(lastDateMs));
}

// Helper para setTextContent local (para evitar importar do dom.ts se não necessário ou manter coerência)
function setTextContent(element: HTMLElement, text: string) {
    if (element.textContent !== text) {
        element.textContent = text;
    }
}

function _updateEvolutionIndicator(chartData: ChartDataPoint[], { xScale, yScale }: ChartScales, chartWidthPx: number) {
    const { evolutionIndicator } = ui.chart;
    const lastPoint = chartData[chartData.length - 1];
    const referencePoint = chartData.find(d => d.scheduledCount > 0) || chartData[0];
    const evolution = ((lastPoint.value - referencePoint.value) / referencePoint.value) * 100;
    
    // DOM WRITE
    const newClass = `chart-evolution-indicator ${evolution >= 0 ? 'positive' : 'negative'}`;
    if (evolutionIndicator.className !== newClass) {
        evolutionIndicator.className = newClass;
    }
    setTextContent(evolutionIndicator, `${evolution > 0 ? '+' : ''}${evolution.toFixed(1)}%`);
    
    const lastPointX = xScale(chartData.length - 1);
    evolutionIndicator.style.top = `${yScale(lastPoint.value)}px`;
    
    // Logic updated to use current padding
    let indicatorX = lastPointX + 10;
    const wrapperWidth = chartWidthPx;
    
    // Se o indicador ultrapassar a borda direita, move para a esquerda do ponto
    if (indicatorX + evolutionIndicator.offsetWidth > wrapperWidth) {
        indicatorX = lastPointX - evolutionIndicator.offsetWidth - 10;
    }
    
    // Proteção adicional para não sair da tela pela esquerda
    if (indicatorX < 0) {
         indicatorX = 0;
    }

    evolutionIndicator.style.left = `${indicatorX}px`;
}

function _updateChartDOM(chartData: ChartDataPoint[]) {
    const { areaPath, linePath } = ui.chart;
    if (!areaPath || !linePath) return;

    // OPTIMIZATION [2025-03-09]: Prevent Layout Thrashing.
    // Use cached width from ResizeObserver if available.
    let svgWidth = currentChartWidth;
    
    // Fallback: If cache is empty (first run), measure immediately.
    if (!svgWidth) {
        svgWidth = ui.chart.wrapper.getBoundingClientRect().width;
        // Do not update cache here to let ResizeObserver handle the source of truth,
        // or update it lazily.
        if (svgWidth > 0) currentChartWidth = svgWidth;
    }
    
    // Fallback: If layout hasn't updated yet, use container width approximation
    if (!svgWidth && ui.chartContainer.clientWidth > 0) {
        // Subtract padding (32px total from CSS --space-lg = 16px * 2)
        svgWidth = ui.chartContainer.clientWidth - 32;
    }
    // Safety fallback
    if (!svgWidth) svgWidth = 300;

    // ADVANCED OPTIMIZATION [2025-03-18]: Render Memoization (Pure Function Check).
    // If the data reference hasn't changed AND the width is the same as last render,
    // we can safely skip the expensive math and DOM updates.
    if (chartData === renderedDataRef && svgWidth === renderedWidth) {
        return;
    }

    // WRITE PHASE: Apply calculations and update DOM.
    const scales = _calculateChartScales(chartData, svgWidth);
    const { areaPathData, linePathData } = _generatePathData(chartData, scales);
    
    areaPath.setAttribute('d', areaPathData);
    linePath.setAttribute('d', linePathData);
    
    _updateAxisLabels(chartData);
    
    // Pass the already measured width to avoid re-measuring
    _updateEvolutionIndicator(chartData, scales, svgWidth);

    // Update Memoization State
    renderedDataRef = chartData;
    renderedWidth = svgWidth;
    cachedChartRect = null;
}

// CORE RENDER LOGIC [2025-02-02]: Extracted for re-use.
function updateTooltipPosition() {
    rafId = null; // Clear flag to allow next frame request
    const { wrapper, tooltip, indicator, tooltipDate, tooltipScoreLabel, tooltipScoreValue, tooltipHabits } = ui.chart;

    if (!wrapper || !tooltip || !indicator || !tooltipDate || !tooltipScoreLabel || !tooltipScoreValue || !tooltipHabits) return;
    if (lastChartData.length === 0 || !wrapper.isConnected) return;

    // LAZY LAYOUT: Only measure the DOM if cache is invalid/null.
    // Isso evita forçar reflow em cada movimento do mouse.
    if (!cachedChartRect) {
        cachedChartRect = wrapper.getBoundingClientRect();
    }

    const svgWidth = cachedChartRect.width;
    if (svgWidth === 0) return;

    const padding = CHART_PADDING;
    const chartWidth = svgWidth - padding.left - padding.right;
    
    // Math optimization: Single calculation path (Projeção linear do mouse para o índice do array)
    const x = inputClientX - cachedChartRect.left;
    const index = Math.round((x - padding.left) / chartWidth * (lastChartData.length - 1));
    const pointIndex = Math.max(0, Math.min(lastChartData.length - 1, index));

    // Dirty Check: Surgical DOM update only on index change
    if (pointIndex !== lastRenderedPointIndex) {
        lastRenderedPointIndex = pointIndex;
        
        const point = lastChartData[pointIndex];
        const { minVal, valueRange } = chartMetadata;
        const chartHeight = SVG_HEIGHT - padding.top - padding.bottom;
    
        const pointX = padding.left + (pointIndex / (lastChartData.length - 1)) * chartWidth;
        const pointY = padding.top + chartHeight - ((point.value - minVal) / valueRange) * chartHeight;

        // DOM WRITES (Batching styles)
        indicator.style.opacity = '1';
        indicator.style.transform = `translateX(${pointX}px)`;
        const dot = indicator.querySelector<HTMLElement>('.chart-indicator-dot');
        if (dot) dot.style.top = `${pointY}px`;
        
        // PERFORMANCE [2025-03-09]: Use pre-calculated timestamp instead of allocating new Date.
        const formattedDate = getDateTimeFormat(state.activeLanguageCode, { 
            weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' 
        }).format(point.timestamp);
        
        setTextContent(tooltipDate, formattedDate);
        setTextContent(tooltipScoreLabel, t('chartTooltipScore') + ': ');
        setTextContent(tooltipScoreValue, point.value.toFixed(2));
        setTextContent(tooltipHabits, t('chartTooltipCompleted', { completed: point.completedCount, total: point.scheduledCount }));

        if (!tooltip.classList.contains('visible')) {
            tooltip.classList.add('visible');
        }
        
        // Logic to keep tooltip onscreen
        let translateX = '-50%';
        if (pointX < 50) translateX = '0%';
        else if (pointX > svgWidth - 50) translateX = '-100%';

        // GPU Composite Layer Transform
        tooltip.style.transform = `translate3d(calc(${pointX}px + ${translateX}), calc(${pointY - 20}px - 100%), 0)`;
    }
}

function _setupChartListeners() {
    const { wrapper, tooltip, indicator } = ui.chart;
    if (!wrapper || !tooltip || !indicator) return;

    // Handler de Input: Solicita o frame APENAS se um não estiver pendente
    // Desacopla a frequência do mouse (125Hz+) da frequência de renderização (60Hz).
    const handlePointerMove = (e: PointerEvent) => {
        inputClientX = e.clientX;
        if (!rafId) {
            rafId = requestAnimationFrame(updateTooltipPosition);
        }
    };

    const handlePointerLeave = () => {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        tooltip.classList.remove('visible');
        indicator.style.opacity = '0';
        lastRenderedPointIndex = -1;
    };

    wrapper.addEventListener('pointermove', handlePointerMove);
    wrapper.addEventListener('pointerleave', handlePointerLeave);
    wrapper.addEventListener('pointercancel', handlePointerLeave);
}

function _initObservers() {
    if (!ui.chartContainer) return;

    // PERFORMANCE: IntersectionObserver.
    // Pausa a renderização do gráfico se ele não estiver visível na viewport.
    if (!chartObserver) {
        chartObserver = new IntersectionObserver((entries) => {
            const entry = entries[0];
            isChartVisible = entry.isIntersecting;
            if (isChartVisible && isChartDirty) {
                isChartDirty = false;
                _updateChartDOM(lastChartData);
            }
        }, { threshold: 0.1 });
        chartObserver.observe(ui.chartContainer);
    }

    // PERFORMANCE: ResizeObserver.
    // Detecta mudanças de tamanho do container para invalidar caches de geometria.
    if (!resizeObserver) {
        resizeObserver = new ResizeObserver(entries => {
            // OPTIMIZATION [2025-03-09]: Update width cache on resize.
            currentChartWidth = ui.chart.wrapper.getBoundingClientRect().width;
            
            if (!isChartVisible) return;
            // Invalida cache de geometria (bounding rect para tooltip) no resize
            cachedChartRect = null;
            _updateChartDOM(lastChartData);
        });
        resizeObserver.observe(ui.chartContainer);
    }
}

export function initChartInteractions() {
    _setupChartListeners();
    _initObservers();
}

/**
 * Função pública de renderização do gráfico.
 * Orquestra o cálculo de dados e a atualização do DOM.
 */
export function renderChart() {
    // FIX: Use isChartDataDirty() function to check if chart data needs recalculation. This function is designed to be called once per render cycle and consumes the dirty flag.
    if (isChartDataDirty() || lastChartData.some(d => d.date === '')) {
        // Recalculate using Pool
        lastChartData = calculateChartData();
        // BUGFIX: Reset rendered index to force tooltip update even if mouse didn't move
        lastRenderedPointIndex = -1; 
        
        // CRITICAL FIX [2025-03-22]: Reset memoization reference.
        // Como usamos Object Pooling (chartDataPool), a referência do array 'lastChartData'
        // não muda entre atualizações. Isso enganava o check de memoization em '_updateChartDOM',
        // impedindo a re-renderização visual mesmo com dados novos.
        renderedDataRef = null;
    }

    const isEmpty = lastChartData.length < 2 || lastChartData.every(d => d.scheduledCount === 0);
    
    ui.chartContainer.classList.toggle('is-empty', isEmpty);

    if (ui.chart.title) {
        const newTitle = t('appName');
        // Dirty Check Text
        if (ui.chart.title.innerHTML !== newTitle) {
            ui.chart.title.innerHTML = newTitle;
        }
    }
    if (ui.chart.subtitle) {
        const summary = calculateDaySummary(state.selectedDate);
        const hasCompletedHabits = summary.completed > 0;
        const newSubtitleKey = hasCompletedHabits ? 'chartSubtitleProgress' : 'appSubtitle';
        const newSubtitle = t(newSubtitleKey);

        if (ui.chart.subtitle.textContent !== newSubtitle) {
            ui.chart.subtitle.textContent = newSubtitle;
        }
    }
    
    if (isEmpty) {
        if (ui.chart.emptyState) {
            const newEmptyText = t('chartEmptyState');
            if (ui.chart.emptyState.textContent !== newEmptyText) {
                ui.chart.emptyState.textContent = newEmptyText;
            }
        }
        return;
    }

    if (isChartVisible) {
        _updateChartDOM(lastChartData);
        
        // Se o tooltip estiver ativo, force uma atualização de posição
        if (ui.chart.tooltip && ui.chart.tooltip.classList.contains('visible')) {
            updateTooltipPosition();
        }
        
        isChartDirty = false;
    } else {
        // Se invisível, marca como sujo para atualizar assim que ficar visível
        isChartDirty = true;
    }
}
