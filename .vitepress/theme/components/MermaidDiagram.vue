<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { stableHash } from '../../shared/core/hash'
import { useMermaidRenderer } from '../composables/useMermaidRenderer'
import { readMermaidThemeTokens } from '../composables/useMermaidTheme'
import { useMermaidViewport } from '../composables/useMermaidViewport'
import { useMermaidZoom } from '../composables/useMermaidZoom'
import { shouldShowMermaidToolbar } from '../lib/mermaidLayoutModel'

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
const viewportController = useMermaidViewport({ root, viewport })
const { hasOverflowX } = viewportController
const zoom = useMermaidZoom({ viewBoxWidth, viewBoxHeight, viewport: viewportController })
const { manualScale, scaleLabel, canvasStyle, zoomOut, zoomIn, resetScale } = zoom
const hovered = ref(false)
const focusWithin = ref(false)
const textRisk = ref(false)
onMounted(() => {
  viewportController.start()
  void render()
})

onBeforeUnmount(() => {
  renderer.dispose()
  viewportController.dispose()
})

watch(isDark, () => {
  void render()
})

const controlsVisible = computed(() => {
  return shouldShowMermaidToolbar({
    hasOverflowX: hasOverflowX.value,
    hasManualScale: manualScale.value !== null,
    isHovered: hovered.value,
    isFocusWithin: focusWithin.value
  })
})

async function render(): Promise<void> {
  textRisk.value = false
  viewportController.resetUserScroll()

  const result = await renderer.render()
  if (result === 'rendered') {
    await viewportController.syncLayout()
    updateTextRisk()
    return
  }

  if (result === 'failed') {
    hasOverflowX.value = false
    textRisk.value = false
  }
}

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
    <div
      v-if="svg"
      ref="viewport"
      class="kpo-mermaid__viewport"
      @scroll.passive="viewportController.onScroll"
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
