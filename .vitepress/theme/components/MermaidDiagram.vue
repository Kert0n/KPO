<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { stableHash } from '../../shared/core/hash'
import { clamp } from '../../shared/core/math'
import { useMermaidRenderer } from '../composables/useMermaidRenderer'
import { readMermaidThemeTokens } from '../composables/useMermaidTheme'
import { CONTENT_LAYOUT_TOKENS } from '../lib/contentLayoutTokens'
import {
  resolveCenteredScrollLeft,
  resolveMermaidAutoScale,
  resolveMermaidManualScale,
  resolveMermaidOverflow,
  resolveMermaidRenderedHeight,
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
const instanceId = props.diagramId ?? `kpo-mermaid-${stableHash(decodedCode.value)}`
const renderer = useMermaidRenderer({
  code: decodedCode,
  instanceId,
  themeTokens: readMermaidThemeTokens
})
const { svg, failed, errorMessage, viewBoxWidth, viewBoxHeight } = renderer
const root = ref<HTMLElement | null>(null)
const viewport = ref<HTMLElement | null>(null)
const availableWidth = ref<number | null>(null)
const manualScale = ref<number | null>(null)
const viewportMode = ref<MermaidViewportMode>('desktop')
const hasOverflowX = ref(false)
const userScrolledViewport = ref(false)
const hovered = ref(false)
const focusWithin = ref(false)
const textRisk = ref(false)
const scaleConfig = ref<{
  desktopMinScale: number
  mobileMinScale: number
  wideDiagramMinWidth: number
  minHeight: number
}>({
  desktopMinScale: CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale,
  mobileMinScale: CONTENT_LAYOUT_TOKENS.mermaidMobileMinScale,
  wideDiagramMinWidth: CONTENT_LAYOUT_TOKENS.mermaidWideDiagramMinWidth,
  minHeight: CONTENT_LAYOUT_TOKENS.mermaidMinHeight
})

let resizeObserver: ResizeObserver | null = null
let isProgrammaticScroll = false
let programmaticScrollLeft: number | null = null

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
  renderer.dispose()
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
    minScale:
      viewportMode.value === 'mobile'
        ? scaleConfig.value.mobileMinScale
        : scaleConfig.value.desktopMinScale,
    minHeight: scaleConfig.value.minHeight,
    wideDiagramMinWidth: scaleConfig.value.wideDiagramMinWidth
  })
})

const effectiveScale = computed(() => manualScale.value ?? autoScale.value)

const scaleLabel = computed(() => `${Math.round(effectiveScale.value * 100)}%`)

const controlsVisible = computed(() => {
  return shouldShowMermaidToolbar({
    hasOverflowX: hasOverflowX.value,
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

  const renderedHeight = resolveMermaidRenderedHeight(viewBoxHeight.value, effectiveScale.value)
  if (renderedHeight) {
    style['--kpo-mermaid-render-height'] = `${renderedHeight}px`
  }

  return style
})

async function render(): Promise<void> {
  textRisk.value = false
  userScrolledViewport.value = false

  const result = await renderer.render()
  if (result === 'rendered') {
    await syncViewportLayout()
    updateTextRisk()
    return
  }

  if (result === 'failed') {
    hasOverflowX.value = false
    textRisk.value = false
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
    desktopMinScale: cssNumber(
      style,
      '--kpo-mermaid-desktop-min-scale',
      CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale
    ),
    mobileMinScale: cssNumber(
      style,
      '--kpo-mermaid-mobile-min-scale',
      CONTENT_LAYOUT_TOKENS.mermaidMobileMinScale
    ),
    wideDiagramMinWidth: cssNumber(
      style,
      '--kpo-mermaid-wide-diagram-min-width',
      CONTENT_LAYOUT_TOKENS.mermaidWideDiagramMinWidth
    ),
    minHeight: cssNumber(style, '--kpo-mermaid-min-height', CONTENT_LAYOUT_TOKENS.mermaidMinHeight)
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

async function syncViewportLayout(
  options: {
    forceCenter?: boolean
    centerRatio?: number | null
  } = {}
): Promise<void> {
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
    return
  }

  const state = resolveMermaidOverflow({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  })

  hasOverflowX.value = state.hasOverflowX
}

function centerViewportIfNeeded(force: boolean): void {
  const element = viewport.value
  if (!element || (!force && userScrolledViewport.value)) return

  if (!hasOverflowX.value) {
    setViewportScrollLeft(0)
    return
  }

  setViewportScrollLeft(
    resolveCenteredScrollLeft({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    })
  )
}

function restoreViewportCenterRatio(centerRatio: number): void {
  const element = viewport.value
  if (!element) return

  setViewportScrollLeft(
    resolveScrollLeftForCenterRatio({
      centerRatio,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth
    })
  )
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
  programmaticScrollLeft = element.scrollLeft
  window.requestAnimationFrame(() => {
    isProgrammaticScroll = false
    programmaticScrollLeft = null
  })
}

function onViewportScroll(): void {
  const element = viewport.value
  if (
    isProgrammaticScroll &&
    element &&
    programmaticScrollLeft !== null &&
    Math.abs(element.scrollLeft - programmaticScrollLeft) <= 2
  ) {
    return
  }

  isProgrammaticScroll = false
  programmaticScrollLeft = null
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
</script>

<template>
  <div
    ref="root"
    class="kpo-mermaid"
    :class="{
      'kpo-mermaid--controls-visible': controlsVisible,
      'kpo-mermaid--has-overflow': hasOverflowX,
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
    <div v-if="svg" ref="viewport" class="kpo-mermaid__viewport" @scroll.passive="onViewportScroll">
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
