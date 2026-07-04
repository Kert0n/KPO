<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  readSvgViewBox,
  resolveMermaidAutoScale,
  resolveMermaidManualScale,
  resolveMermaidRenderedWidth,
  type MermaidViewportMode
} from '../lib/mermaidLayoutModel'

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
const svg = ref('')
const failed = ref(false)
const errorMessage = ref('')
const availableWidth = ref<number | null>(null)
const manualScale = ref<number | null>(null)
const viewBoxWidth = ref<number | null>(null)
const viewBoxHeight = ref<number | null>(null)
const viewportMode = ref<MermaidViewportMode>('desktop')
const scaleConfig = ref({
  desktopMinScale: 0.72,
  mobileMinScale: 0.4,
  mobileMinWidth: 680,
  minHeight: 120
})

let renderCounter = 0
let resizeObserver: ResizeObserver | null = null
const instanceId = props.diagramId ?? `kpo-mermaid-${stableHash(decodedCode.value)}`

onMounted(() => {
  updateMeasurements()
  resizeObserver = new ResizeObserver(updateMeasurements)
  if (root.value) resizeObserver.observe(root.value)
  window.addEventListener('resize', updateMeasurements)
  void render()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', updateMeasurements)
})

watch(isDark, render)

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

  try {
    const { default: mermaid } = await import('mermaid')

    mermaid.initialize({
      startOnLoad: false,
      theme: isDark.value ? 'dark' : 'neutral',
      fontFamily: 'Inter Variable, Inter, sans-serif'
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
    await nextTick()
    updateMeasurements()
  } catch (error) {
    console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
    errorMessage.value = error instanceof Error ? error.message : String(error)
    svg.value = ''
    viewBoxWidth.value = null
    viewBoxHeight.value = null
    failed.value = true
  }
}

function zoomOut(): void {
  manualScale.value = resolveMermaidManualScale({
    currentScale: effectiveScale.value,
    delta: -0.1,
    mode: viewportMode.value
  })
}

function zoomIn(): void {
  manualScale.value = resolveMermaidManualScale({
    currentScale: effectiveScale.value,
    delta: 0.1,
    mode: viewportMode.value
  })
}

function resetScale(): void {
  manualScale.value = null
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
</script>

<template>
  <div ref="root" class="kpo-mermaid">
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
    <div v-if="svg" class="kpo-mermaid__viewport">
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
