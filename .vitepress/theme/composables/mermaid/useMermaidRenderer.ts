import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

type MermaidRendererOptions = {
  code: () => string
  instanceId: string
  isDark: Ref<boolean>
  config: () => object
  disabled?: () => boolean
  onRendered: (svg: string) => Promise<void> | void
  onFailed: () => void
}

export function useMermaidRenderer(options: MermaidRendererOptions) {
  const svg = ref('')
  const failed = ref(false)
  const errorMessage = ref('')
  const renderState = ref<'loading' | 'ready' | 'error'>('loading')
  const renderRevision = ref(0)
  let renderCounter = 0
  let generation = 0

  async function render(): Promise<void> {
    const currentGeneration = ++generation
    renderRevision.value += 1
    renderState.value = 'loading'
    failed.value = false
    errorMessage.value = ''
    svg.value = ''

    try {
      const { default: mermaid } = await import('mermaid')
      if (currentGeneration !== generation) return
      mermaid.initialize(options.config())
      renderCounter += 1
      const result = await mermaid.render(`${options.instanceId}-${renderCounter}`, options.code())
      if (currentGeneration !== generation) return
      svg.value = result.svg
      await options.onRendered(result.svg)
      if (currentGeneration !== generation) return
      renderState.value = 'ready'
    } catch (error) {
      if (currentGeneration !== generation) return
      console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
      errorMessage.value = error instanceof Error ? error.message : String(error)
      svg.value = ''
      failed.value = true
      renderState.value = 'error'
      options.onFailed()
    }
  }

  onMounted(() => {
    if (options.disabled?.()) {
      renderState.value = 'ready'
      return
    }
    void render()
  })
  watch(options.isDark, () => {
    if (!options.disabled?.()) void render()
  })
  onBeforeUnmount(() => {
    generation += 1
  })

  return { svg, failed, errorMessage, renderState, renderRevision, render }
}
