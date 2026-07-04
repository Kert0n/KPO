<script setup lang="ts">
import { useData } from 'vitepress'
import { computed, onMounted, ref, watch } from 'vue'

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
const svg = ref('')
const failed = ref(false)
const errorMessage = ref('')
const viewBoxWidth = ref<number | null>(null)
const viewBoxHeight = ref<number | null>(null)

const mobileMinWidth = 720
const mobileMinHeight = 120
const mobileFitWidth = 360

let renderCounter = 0
const instanceId = props.diagramId ?? `kpo-mermaid-${stableHash(decodedCode.value)}`

onMounted(render)
watch(isDark, render)

const canvasStyle = computed(() => {
  const style: Record<string, string> = {}

  if (viewBoxWidth.value) {
    style['--kpo-mermaid-view-width'] = `${viewBoxWidth.value}px`
    style['--kpo-mermaid-readable-width'] = `${readableWidth(
      viewBoxWidth.value,
      viewBoxHeight.value
    )}px`
  }

  if (viewBoxHeight.value) {
    style['--kpo-mermaid-view-height'] = `${viewBoxHeight.value}px`
  }

  return style
})

async function render(): Promise<void> {
  failed.value = false
  errorMessage.value = ''

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
  } catch (error) {
    console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
    errorMessage.value = error instanceof Error ? error.message : String(error)
    viewBoxWidth.value = null
    viewBoxHeight.value = null
    failed.value = true
  }
}

function readSvgViewBox(rendered: string): { width: number | null; height: number | null } {
  const match = rendered.match(/\sviewBox="([^"]+)"/)
  if (!match) return { width: null, height: null }

  const [, , width, height] = match[1].trim().split(/\s+/).map(Number)

  return {
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null
  }
}

function readableWidth(width: number, height: number | null): number {
  if (width <= mobileFitWidth) return width
  if (!height || height <= 0) return mobileMinWidth

  const widthForReadableHeight = (mobileMinHeight * width) / height
  return Math.ceil(Math.max(mobileMinWidth, widthForReadableHeight))
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
  <div class="kpo-mermaid">
    <div v-if="svg" class="kpo-mermaid__canvas" :style="canvasStyle" v-html="svg" />
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
