<script setup lang="ts">
import { useData } from 'vitepress'
import { onMounted, ref, watch } from 'vue'

/**
 * Диаграммы Mermaid. Рендер только на клиенте (динамический import),
 * тема диаграммы следует теме сайта: при переключении светлая/тёмная
 * диаграмма перерисовывается с подходящей палитрой.
 */

const props = defineProps<{
  /** Код диаграммы в URL-кодировке (см. markdown/mermaid.ts) */
  code: string
}>()

const { isDark } = useData()

const svg = ref('')
const failed = ref(false)

let renderCounter = 0
const instanceId = `kpo-mermaid-${Math.random().toString(36).slice(2, 8)}`

onMounted(render)
watch(isDark, render)

async function render(): Promise<void> {
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
      decodeURIComponent(props.code)
    )
    svg.value = rendered
    failed.value = false
  } catch (error) {
    console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
    failed.value = true
  }
}
</script>

<template>
  <div class="kpo-mermaid">
    <div v-if="svg" class="kpo-mermaid__canvas" v-html="svg" />
    <pre v-else-if="failed" class="kpo-mermaid__fallback">{{ decodeURIComponent(code) }}</pre>
    <div v-else class="kpo-mermaid__loading">Загрузка диаграммы…</div>
  </div>
</template>
