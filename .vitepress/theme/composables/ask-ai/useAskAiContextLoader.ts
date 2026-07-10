import { onBeforeUnmount, onMounted } from 'vue'
import { withBase } from 'vitepress'
import {
  askAiContextUrlForRoute,
  routePathToAskAiContextKey,
  type AskAiPageContext
} from '../../../shared/core/askAiModel'

export function useAskAiContextLoader(options: {
  routePath: () => string
  base: () => string
  enabled: () => boolean
}) {
  const cache = new Map<string, AskAiPageContext>()
  let prefetchTimer: number | null = null
  let abortController: AbortController | null = null

  async function loadPageContext(): Promise<AskAiPageContext> {
    const key = routePathToAskAiContextKey(options.routePath(), options.base())
    const cached = cache.get(key)
    if (cached) return cached
    abort()
    const controller = new AbortController()
    abortController = controller
    try {
      const response = await fetch(askAiContextUrlForRoute(options.routePath(), options.base(), withBase), {
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`Ask AI context HTTP ${response.status}`)
      const context = (await response.json()) as AskAiPageContext
      cache.set(key, context)
      return context
    } finally {
      if (abortController === controller) abortController = null
    }
  }

  function queuePrefetch(): void {
    clearPrefetch()
    if (!options.enabled()) return
    prefetchTimer = window.setTimeout(() => {
      prefetchTimer = null
      loadPageContext().catch(() => undefined)
    }, 0)
  }

  function clearPrefetch(): void {
    if (prefetchTimer !== null) window.clearTimeout(prefetchTimer)
    prefetchTimer = null
  }

  function abort(): void {
    abortController?.abort()
    abortController = null
  }

  onMounted(queuePrefetch)
  onBeforeUnmount(() => {
    clearPrefetch()
    abort()
  })

  return { loadPageContext, queuePrefetch, clearPrefetch, abort }
}
