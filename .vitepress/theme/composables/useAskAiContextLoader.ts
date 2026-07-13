import { ref } from 'vue'
import {
  askAiContextUrlForRoute,
  routePathToAskAiContextKey,
  type AskAiPageContext
} from '../lib/askAiModel'

export function useAskAiContextLoader(options: {
  routePath: () => string
  base: () => string
  withBase: (path: string) => string
}) {
  const contextCache = new Map<string, AskAiPageContext>()
  const loading = ref(false)
  let abortController: AbortController | null = null
  let prefetchTimer: number | null = null
  let generation = 0

  async function loadPageContext(): Promise<AskAiPageContext> {
    const routePath = options.routePath()
    const base = options.base()
    const key = routePathToAskAiContextKey(routePath, base)
    const cached = contextCache.get(key)
    if (cached) return cached

    const currentGeneration = ++generation
    abortController?.abort()
    const requestController = new AbortController()
    abortController = requestController
    loading.value = true

    try {
      const response = await fetch(askAiContextUrlForRoute(routePath, base, options.withBase), {
        signal: requestController.signal
      })
      if (!response.ok) throw new Error(`Ask AI context HTTP ${response.status}`)
      const context = (await response.json()) as AskAiPageContext
      if (currentGeneration !== generation)
        throw new DOMException('Stale Ask AI context', 'AbortError')
      contextCache.set(key, context)
      return context
    } finally {
      if (abortController === requestController) abortController = null
      if (currentGeneration === generation) loading.value = false
    }
  }

  function queuePrefetch(): void {
    clearPrefetchTimer()
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = null
      loadPageContext().catch(() => undefined)
    }, 0)
  }

  function invalidateRoute(): void {
    generation += 1
    loading.value = false
    abortController?.abort()
    abortController = null
    clearPrefetchTimer()
  }

  function dispose(): void {
    invalidateRoute()
  }

  function clearPrefetchTimer(): void {
    if (prefetchTimer !== null) window.clearTimeout(prefetchTimer)
    prefetchTimer = null
  }

  return { loadPageContext, queuePrefetch, invalidateRoute, dispose, loading }
}
