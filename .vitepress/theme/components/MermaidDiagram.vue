<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  readSvgViewBox,
  resolveCenteredScrollLeft,
  resolveMermaidAutoScale,
  resolveMermaidManualScale,
  resolveMermaidOverflow,
  resolveMermaidRenderedWidth,
  resolveScrollLeftForCenterRatio,
  shouldShowMermaidToolbar,
  type MermaidViewportMode
} from '../lib/mermaidLayoutModel'
import { waitAnimationFrames } from '../lib/viewportAnchor'

/**
 * Диаграммы Mermaid. Рендер только на клиенте (динамический import),
 * тема диаграммы следует теме сайта: при переключении светлая/тёмная
 * диаграмма перерисовывается с подходящей палитрой.
 */

const props = defineProps<{
  /** Код диаграммы в URL-кодировке (см. markdown/mermaid.ts) */
  code: string
  diagramId?: string
}>()

const { isDark } = useData()

const decodedCode = computed(() => decodeURIComponent(props.code))
const root = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const svg = ref('')
const failed = ref(false)
const errorMessage = ref('')
const availableWidth = ref<number | null>(null)
const manualScale = ref<number | null>(null)
const viewBoxWidth = ref<number | null>(null)
const viewBoxHeight = ref<number | null>(null)
const viewportMode = ref<MermaidViewportMode>('desktop')
const hasOverflowX = ref(false)
const hasOverflowY = ref(false)
const userScrolledViewport = ref(false)
const hovered = ref(false)
const focusWithin = ref(false)
const textRisk = ref(false)
const scaleConfig = ref({
  desktopMinScale: 0.72,
  mobileMinScale: 0.4,
  mobileMinWidth: 680,
  minHeight: 120
})

let renderCounter = 0
let resizeObserver: ResizeObserver | null = null
let isProgrammaticScroll = false
const instanceId = props.diagramId ?? `kpo-mermaid-${stableHash(decodedCode.value)}`

onMounted(() => {
  updateMeasurements()
  resizeObserver = new ResizeObserver(() => {
    updateMeasurements()
    void syncViewportLayout()
  })
  if (root.value) resizeObserver.observe(root.value)
  window.addEventListener('resize', onWindowResize)
  void render()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', onWindowResize)
})

watch(isDark, () => {
  void render()
})

const autoScale = computed(() => {
  return resolveMermaidAutoScale({
    viewBoxWidth: viewBoxWidth.value,
    viewBoxHeight: viewBoxHeight.value,
    availableWidth: availableWidth.value,
    minScale: viewportMode.value === 'mobile'
      ? scaleConfig.value.mobileMinScale
      : scaleConfig.value.desktopMinScale,
    minHeight: scaleConfig.value.minHeight,
    minRenderedWidth: viewportMode.value === 'mobile'
      ? scaleConfig.value.mobileMinWidth
      : undefined
  })
})

const effectiveScale = computed(() => manualScale.value ?? autoScale.value)

const scaleLabel = computed(() => `${Math.round(effectiveScale.value * 100)}%`)

const controlsVisible = computed(() => {
  return shouldShowMermaidToolbar({
    hasOverflowX: hasOverflowX.value,
    hasOverflowY: hasOverflowY.value,
    hasManualScale: manualScale.value !== null,
    isHovered: hovered.value,
    isFocusWithin: focusWithin.value
  })
})

const canvasStyle = computed(() => {
  const style: Record<string, string> = {}

  const renderedWidth = resolveMermaidRenderedWidth(viewBoxWidth.value, effectiveScale.value)
  if (renderedWidth) {
    style['--kpo-mermaid-render-width'] = `${renderedWidth}px`
  }

  return style
})

async function render(): Promise<void> {
  failed.value = false
  errorMessage.value = ''
  svg.value = ''
  textRisk.value = false
  userScrolledViewport.value = false

  try {
    const { default: mermaid } = await import('mermaid')

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: mermaidThemeVariables(),
      fontFamily: mermaidFontFamily(),
      flowchart: {
        htmlLabels: true,
        wrappingWidth: 180
      }
    })

    renderCounter += 1
    const { svg: rendered } = await mermaid.render(
      `${instanceId}-${renderCounter}`,
      decodedCode.value
    )
    const size = readSvgViewBox(rendered)
    viewBoxWidth.value = size.width
    viewBoxHeight.value = size.height
    svg.value = rendered
    await syncViewportLayout()
    updateTextRisk()
  } catch (error) {
    console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
    errorMessage.value = error instanceof Error ? error.message : String(error)
    svg.value = ''
    viewBoxWidth.value = null
    viewBoxHeight.value = null
    hasOverflowX.value = false
    hasOverflowY.value = false
    textRisk.value = false
    failed.value = true
  }
}

async function zoomOut(): Promise<void> {
  await updateManualScale(-0.1)
}

async function zoomIn(): Promise<void> {
  await updateManualScale(0.1)
}

async function resetScale(): Promise<void> {
  manualScale.value = null
  userScrolledViewport.value = false
  await syncViewportLayout({ forceCenter: true })
}

function updateMeasurements(): void {
  if (!root.value) return

  viewportMode.value = window.matchMedia('(max-width: 639px)').matches ? 'mobile' : 'desktop'

  const style = getComputedStyle(root.value)
  const inlinePadding = cssPixels(style.paddingLeft) + cssPixels(style.paddingRight)
  availableWidth.value = Math.max(0, root.value.clientWidth - inlinePadding)

  scaleConfig.value = {
    desktopMinScale: cssNumber(style, '--kpo-mermaid-desktop-min-scale', 0.72),
    mobileMinScale: cssNumber(style, '--kpo-mermaid-mobile-min-scale', 0.4),
    mobileMinWidth: cssNumber(style, '--kpo-mermaid-mobile-min-width', 680),
    minHeight: cssNumber(style, '--kpo-mermaid-min-height', 120)
  }
}

async function updateManualScale(delta: number): Promise<void> {
  const centerRatio = currentViewportCenterRatio()
  manualScale.value = resolveMermaidManualScale({
    currentScale: effectiveScale.value,
    delta,
    mode: viewportMode.value
  })
  await syncViewportLayout({ centerRatio })
}

async function syncViewportLayout(options: {
  forceCenter?: boolean
  centerRatio?: number | null
} = {}): Promise<void> {
  await nextTick()
  await waitAnimationFrames(2)
  updateMeasurements()
  updateOverflowState()

  if (options.centerRatio !== undefined && options.centerRatio !== null) {
    restoreViewportCenterRatio(options.centerRatio)
    return
  }

  centerViewportIfNeeded(Boolean(options.forceCenter))
}

function updateOverflowState(): void {
  const element = viewport.value
  if (!element) {
    hasOverflowX.value = false
    hasOverflowY.value = false
    return
  }

  const state = resolveMermaidOverflow({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  })

  hasOverflowX.value = state.hasOverflowX
  hasOverflowY.value = state.hasOverflowY
}

function centerViewportIfNeeded(force: boolean): void {
  const element = viewport.value
  if (!element || (!force && userScrolledViewport.value)) return

  if (!hasOverflowX.value) {
    setViewportScrollLeft(0)
    return
  }

  setViewportScrollLeft(resolveCenteredScrollLeft({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }))
}

function restoreViewportCenterRatio(centerRatio: number): void {
  const element = viewport.value
  if (!element) return

  setViewportScrollLeft(resolveScrollLeftForCenterRatio({
    centerRatio,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }))
}

function currentViewportCenterRatio(): number | null {
  const element = viewport.value
  if (!element || element.scrollWidth <= 0) return null

  return clamp((element.scrollLeft + element.clientWidth / 2) / element.scrollWidth, 0, 1)
}

function setViewportScrollLeft(scrollLeft: number): void {
  const element = viewport.value
  if (!element) return

  isProgrammaticScroll = true
  element.scrollLeft = scrollLeft
  window.requestAnimationFrame(() => {
    isProgrammaticScroll = false
  })
}

function onViewportScroll(): void {
  if (isProgrammaticScroll) return
  userScrolledViewport.value = true
}

function onFocusOut(): void {
  void nextTick(() => {
    focusWithin.value = Boolean(root.value?.contains(document.activeElement))
  })
}

function onWindowResize(): void {
  updateMeasurements()
  void syncViewportLayout()
}

function mermaidThemeVariables(): Record<string, string> {
  const style = getComputedStyle(document.documentElement)
  const background = cssVariable(style, '--vp-c-bg')
  const softBackground = cssVariable(style, '--vp-c-bg-soft')
  const text = cssVariable(style, '--vp-c-text-1')
  const mutedText = cssVariable(style, '--vp-c-text-2')
  const border = cssVariable(style, '--vp-c-border')

  return {
    fontFamily: mermaidFontFamily(),
    primaryColor: softBackground,
    primaryTextColor: text,
    primaryBorderColor: border,
    lineColor: mutedText,
    secondaryColor: softBackground,
    tertiaryColor: background,
    background,
    mainBkg: background,
    secondBkg: softBackground,
    edgeLabelBackground: background,
    clusterBkg: softBackground,
    clusterBorder: border,
    noteBkgColor: softBackground,
    noteTextColor: text,
    noteBorderColor: border,
    textColor: text,
    nodeTextColor: text,
    labelTextColor: text
  }
}

function mermaidFontFamily(): string {
  if (typeof window === 'undefined') return 'Inter Variable, Inter, sans-serif'

  return cssVariable(
    getComputedStyle(document.documentElement),
    '--vp-font-family-base',
    'Inter Variable, Inter, sans-serif'
  )
}

function cssVariable(style: CSSStyleDeclaration, property: string, fallback = ''): string {
  return style.getPropertyValue(property).trim() || fallback
}

function updateTextRisk(): void {
  const element = root.value?.querySelector('svg')
  if (!element) {
    textRisk.value = false
    return
  }

  const foreignObjects = [...element.querySelectorAll('foreignObject')]
  textRisk.value = foreignObjects.some((node) => {
    const child = node.firstElementChild
    if (!child) return false

    const containerRect = node.getBoundingClientRect()
    const childRect = child.getBoundingClientRect()
    return childRect.width > containerRect.width + 2 || childRect.height > containerRect.height + 2
  })
}

function cssPixels(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function cssNumber(style: CSSStyleDeclaration, property: string, fallback: number): number {
  const parsed = Number.parseFloat(style.getPropertyValue(property))
  return Number.isFinite(parsed) ? parsed : fallback
}

function stableHash(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
</script>

<template>
  <div
    ref="root"
    class="kpo-mermaid"
    :class="{
      'kpo-mermaid--controls-visible': controlsVisible,
      'kpo-mermaid--has-overflow': hasOverflowX || hasOverflowY,
      'kpo-mermaid--text-risk': textRisk
    }"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focusWithin = true"
    @focusout="onFocusOut"
  >
    <div v-if="svg" class="kpo-mermaid__toolbar">
      <button
        type="button"
        class="kpo-mermaid__zoom-button"
        title="Уменьшить диаграмму"
        aria-label="Уменьшить диаграмму"
        @click="zoomOut"
      >
        −
      </button>
      <button
        type="button"
        class="kpo-mermaid__zoom-reset"
        title="Сбросить масштаб диаграммы"
        aria-label="Сбросить масштаб диаграммы"
        :disabled="manualScale === null"
        @click="resetScale"
      >
        {{ scaleLabel }}
      </button>
      <button
        type="button"
        class="kpo-mermaid__zoom-button"
        title="Увеличить диаграмму"
        aria-label="Увеличить диаграмму"
        @click="zoomIn"
      >
        +
      </button>
    </div>
    <div
      v-if="svg"
      ref="viewport"
      class="kpo-mermaid__viewport"
      @scroll.passive="onViewportScroll"
    >
      <div class="kpo-mermaid__canvas" :style="canvasStyle" v-html="svg" />
    </div>
    <div v-else-if="failed" class="kpo-mermaid__error">
      <p class="kpo-mermaid__error-title">Диаграмма не отрисовалась</p>
      <p class="kpo-mermaid__error-message">{{ errorMessage }}</p>
      <details class="kpo-mermaid__source">
        <summary>Исходник Mermaid</summary>
        <pre class="kpo-mermaid__fallback">{{ decodedCode }}</pre>
      </details>
    </div>
    <div v-else class="kpo-mermaid__loading">Загрузка диаграммы…</div>
  </div>
</template>
