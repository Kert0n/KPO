import { ref } from 'vue'
import { readSvgViewBox } from '../lib/mermaidLayoutModel'
import { createMermaidConfig, type MermaidThemeTokens } from '../lib/mermaidThemeModel'

export type MermaidRenderResult = 'rendered' | 'failed' | 'stale'

export type MermaidRenderRequest = {
  code: string
  theme: MermaidThemeTokens
}

let renderQueue: Promise<void> = Promise.resolve()

export function useMermaidRenderer(options: { instanceId: string }) {
  const svg = ref('')
  const failed = ref(false)
  const errorMessage = ref('')
  const viewBoxWidth = ref<number | null>(null)
  const viewBoxHeight = ref<number | null>(null)
  let generation = 0
  let renderCounter = 0
  let disposed = false

  async function render(request: MermaidRenderRequest): Promise<MermaidRenderResult> {
    const currentGeneration = ++generation
    const code = request.code
    const theme = request.theme
    resetState()

    return enqueue(async () => {
      if (isStale(currentGeneration)) return 'stale'

      try {
        const { default: mermaid } = await import('mermaid')
        if (isStale(currentGeneration)) return 'stale'

        mermaid.initialize(createMermaidConfig(theme))
        const { svg: rendered } = await mermaid.render(
          `${options.instanceId}-${++renderCounter}`,
          code
        )
        if (isStale(currentGeneration)) return 'stale'

        const size = readSvgViewBox(rendered)
        viewBoxWidth.value = size.width
        viewBoxHeight.value = size.height
        svg.value = rendered
        return 'rendered'
      } catch (error) {
        if (isStale(currentGeneration)) return 'stale'
        console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
        errorMessage.value = error instanceof Error ? error.message : String(error)
        failed.value = true
        return 'failed'
      }
    })
  }

  function dispose(): void {
    disposed = true
    generation += 1
  }

  function resetState(): void {
    failed.value = false
    errorMessage.value = ''
    svg.value = ''
    viewBoxWidth.value = null
    viewBoxHeight.value = null
  }

  function isStale(currentGeneration: number): boolean {
    return disposed || currentGeneration !== generation
  }

  return { svg, failed, errorMessage, viewBoxWidth, viewBoxHeight, render, dispose }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = renderQueue.then(task, task)
  renderQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
