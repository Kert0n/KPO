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

let renderCounter = 0
const instanceId = props.diagramId ?? `kpo-mermaid-${stableHash(decodedCode.value)}`

onMounted(render)
watch(isDark, render)

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
    svg.value = rendered
  } catch (error) {
    console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
    errorMessage.value = error instanceof Error ? error.message : String(error)
    failed.value = true
  }
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
    <div v-if="svg" class="kpo-mermaid__canvas" v-html="svg" />
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
