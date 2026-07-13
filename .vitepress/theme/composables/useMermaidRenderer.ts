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
  const rendering = ref(false)
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
    rendering.value = true

    return enqueue(async () => {
      if (isStale(currentGeneration)) return finish(currentGeneration, 'stale')

      try {
        const { default: mermaid } = await import('mermaid')
        if (isStale(currentGeneration)) return finish(currentGeneration, 'stale')

        mermaid.initialize(createMermaidConfig(theme))
        const { svg: rendered } = await mermaid.render(
          `${options.instanceId}-${++renderCounter}`,
          code
        )
        if (isStale(currentGeneration)) return finish(currentGeneration, 'stale')

        const size = readSvgViewBox(rendered)
        viewBoxWidth.value = size.width
        viewBoxHeight.value = size.height
        svg.value = rendered
        return finish(currentGeneration, 'rendered')
      } catch (error) {
        if (isStale(currentGeneration)) return finish(currentGeneration, 'stale')
        console.warn('[mermaid] не удалось отрисовать диаграмму:', error)
        errorMessage.value = error instanceof Error ? error.message : String(error)
        svg.value = ''
        viewBoxWidth.value = null
        viewBoxHeight.value = null
        failed.value = true
        return finish(currentGeneration, 'failed')
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
  }

  function finish(currentGeneration: number, result: MermaidRenderResult): MermaidRenderResult {
    if (currentGeneration === generation) rendering.value = false
    return result
  }

  function isStale(currentGeneration: number): boolean {
    return disposed || currentGeneration !== generation
  }

  return { svg, failed, errorMessage, rendering, viewBoxWidth, viewBoxHeight, render, dispose }
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = renderQueue.then(task, task)
  renderQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}
