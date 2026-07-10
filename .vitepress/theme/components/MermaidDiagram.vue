<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, ref } from 'vue'
import { stableHash } from '../../shared/core/hash'
import {
  readSvgViewBox,
  resolveMermaidAutoScale,
  resolveMermaidRenderedHeight,
  resolveMermaidRenderedWidth,
  shouldShowMermaidToolbar
} from '../lib/mermaidLayoutModel'
import { useMermaidRenderer } from '../composables/mermaid/useMermaidRenderer'
import { useMermaidTheme } from '../composables/mermaid/useMermaidTheme'
import { useMermaidViewport } from '../composables/mermaid/useMermaidViewport'
import { useMermaidZoom } from '../composables/mermaid/useMermaidZoom'

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
const hovered = ref(false)
const focusWithin = ref(false)
const textRisk = ref(false)
const {
  availableWidth,
  viewBoxWidth,
  viewBoxHeight,
  viewportMode,
  hasOverflowX,
  hasOverflowY,
  scaleConfig,
  syncViewportLayout,
  currentViewportCenterRatio,
  resetUserScroll,
  onViewportScroll
} = useMermaidViewport(root, viewport)
const instanceId = props.diagramId ?? `kpo-mermaid-${stableHash(decodedCode.value)}`
const { currentConfig } = useMermaidTheme()
const { svg, failed, errorMessage, renderState, renderRevision } = useMermaidRenderer({
  code: () => decodedCode.value,
  instanceId,
  isDark,
  config: currentConfig,
  disabled: () => document.documentElement.dataset.kpoTestMermaid === 'off',
  async onRendered(rendered) {
    resetUserScroll()
    textRisk.value = false
    const size = readSvgViewBox(rendered)
    viewBoxWidth.value = size.width
    viewBoxHeight.value = size.height
    await syncViewportLayout()
    updateTextRisk()
  },
  onFailed() {
    viewBoxWidth.value = null
    viewBoxHeight.value = null
    hasOverflowX.value = false
    hasOverflowY.value = false
    textRisk.value = false
  }
})

const autoScale = computed(() => {
  return resolveMermaidAutoScale({
    viewBoxWidth: viewBoxWidth.value,
    viewBoxHeight: viewBoxHeight.value,
    availableWidth: availableWidth.value,
    minScale:
      viewportMode.value === 'mobile' ? scaleConfig.value.mobileMinScale : scaleConfig.value.desktopMinScale,
    minHeight: scaleConfig.value.minHeight,
    wideDiagramMinWidth: scaleConfig.value.wideDiagramMinWidth
  })
})

const { manualScale, effectiveScale, scaleLabel, zoomOut, zoomIn, resetScale } = useMermaidZoom({
  autoScale,
  viewportMode,
  currentCenterRatio: currentViewportCenterRatio,
  resetUserScroll,
  syncViewportLayout
})

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

  const renderedHeight = resolveMermaidRenderedHeight(viewBoxHeight.value, effectiveScale.value)
  if (renderedHeight) {
    style['--kpo-mermaid-render-height'] = `${renderedHeight}px`
  }

  return style
})

function onFocusOut(): void {
  void nextTick(() => {
    focusWithin.value = Boolean(root.value?.contains(document.activeElement))
  })
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
</script>

<template>
  <div
    ref="root"
    class="kpo-mermaid"
    :data-kpo-render-state="renderState"
    :data-kpo-render-revision="renderRevision"
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
      role="region"
      aria-label="Диаграмма Mermaid"
      tabindex="0"
      @scroll.passive="onViewportScroll"
    >
      <div class="kpo-mermaid__canvas" :style="canvasStyle" v-html="svg" />
    </div>
    <details v-if="svg" class="kpo-mermaid__source">
      <summary>Исходник Mermaid</summary>
      <pre class="kpo-mermaid__fallback">{{ decodedCode }}</pre>
    </details>
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
