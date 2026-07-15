import { nextTick, ref, type Ref } from 'vue'
import { clamp } from '../../shared/core/math'
import { CONTENT_LAYOUT_TOKENS } from '../lib/contentLayoutTokens'
import {
  resolveCenteredScrollLeft,
  resolveMermaidOverflow,
  resolveScrollLeftForCenterRatio,
  type MermaidViewportMode
} from '../lib/mermaidLayoutModel'
import { waitAnimationFrames } from '../lib/viewportAnchor'

export type MermaidLayoutResult = 'applied' | 'stale'

export function useMermaidViewport(options: {
  root: Ref<HTMLElement | null>
  viewport: Ref<HTMLElement | null>
}) {
  const availableWidth = ref<number | null>(null)
  const viewportMode = ref<MermaidViewportMode>('desktop')
  const hasOverflowX = ref(false)
  const userScrolledViewport = ref(false)
  const scaleConfig = ref<{
    desktopMinScale: number
    mobileMinScale: number
    wideDiagramMinWidth: number
    minHeight: number
  }>({
    desktopMinScale: CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale,
    mobileMinScale: CONTENT_LAYOUT_TOKENS.mermaidMobileMinScale,
    wideDiagramMinWidth: CONTENT_LAYOUT_TOKENS.mermaidWideDiagramMinWidth,
    minHeight: CONTENT_LAYOUT_TOKENS.mermaidMinHeight
  })

  let resizeObserver: ResizeObserver | null = null
  let programmaticScrollLeft: number | null = null
  let lastObservedScrollLeft: number | null = null
  let pendingCenterRatio: number | null = null
  let disposed = false
  let layoutGeneration = 0

  function start(): void {
    disposed = false
    updateMeasurements()
    resizeObserver = new ResizeObserver(() => {
      void syncLayout()
    })
    if (options.root.value) resizeObserver.observe(options.root.value)
  }

  function dispose(): void {
    disposed = true
    layoutGeneration += 1
    resizeObserver?.disconnect()
    resizeObserver = null
    programmaticScrollLeft = null
    lastObservedScrollLeft = null
    pendingCenterRatio = null
  }

  async function syncLayout(
    syncOptions: { forceCenter?: boolean; centerRatio?: number | null } = {}
  ): Promise<MermaidLayoutResult> {
    if (syncOptions.centerRatio !== undefined && syncOptions.centerRatio !== null) {
      pendingCenterRatio = syncOptions.centerRatio
    }
    const centerRatio = pendingCenterRatio
    const generation = ++layoutGeneration
    await nextTick()
    if (isStale(generation)) return 'stale'
    await waitAnimationFrames(2)
    if (isStale(generation)) return 'stale'
    updateMeasurements()
    if (isStale(generation)) return 'stale'
    updateOverflowState()
    if (isStale(generation)) return 'stale'

    if (centerRatio !== null) {
      restoreCenterRatio(centerRatio)
      if (pendingCenterRatio === centerRatio) pendingCenterRatio = null
      return isStale(generation) ? 'stale' : 'applied'
    }
    centerIfNeeded(Boolean(syncOptions.forceCenter))
    return isStale(generation) ? 'stale' : 'applied'
  }

  function updateMeasurements(): void {
    const root = options.root.value
    if (!root || disposed) return
    viewportMode.value = window.matchMedia('(max-width: 639px)').matches ? 'mobile' : 'desktop'
    const style = getComputedStyle(root)
    availableWidth.value = Math.max(
      0,
      root.clientWidth - cssPixels(style.paddingLeft) - cssPixels(style.paddingRight)
    )
    scaleConfig.value = {
      desktopMinScale: cssNumber(
        style,
        '--kpo-mermaid-desktop-min-scale',
        CONTENT_LAYOUT_TOKENS.mermaidDesktopMinScale
      ),
      mobileMinScale: cssNumber(
        style,
        '--kpo-mermaid-mobile-min-scale',
        CONTENT_LAYOUT_TOKENS.mermaidMobileMinScale
      ),
      wideDiagramMinWidth: cssNumber(
        style,
        '--kpo-mermaid-wide-diagram-min-width',
        CONTENT_LAYOUT_TOKENS.mermaidWideDiagramMinWidth
      ),
      minHeight: cssNumber(
        style,
        '--kpo-mermaid-min-height',
        CONTENT_LAYOUT_TOKENS.mermaidMinHeight
      )
    }
  }

  function updateOverflowState(): void {
    const viewport = options.viewport.value
    if (!viewport) {
      hasOverflowX.value = false
      return
    }
    hasOverflowX.value = resolveMermaidOverflow({
      clientWidth: viewport.clientWidth,
      scrollWidth: viewport.scrollWidth
    }).hasOverflowX
  }

  function currentCenterRatio(): number | null {
    const viewport = options.viewport.value
    if (!viewport || viewport.scrollWidth <= 0) return null
    return clamp((viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth, 0, 1)
  }

  function restoreCenterRatio(centerRatio: number): void {
    const viewport = options.viewport.value
    if (!viewport) return
    setScrollLeft(
      resolveScrollLeftForCenterRatio({
        centerRatio,
        clientWidth: viewport.clientWidth,
        scrollWidth: viewport.scrollWidth
      })
    )
  }

  function centerIfNeeded(force: boolean): void {
    const viewport = options.viewport.value
    if (!viewport || (!force && userScrolledViewport.value)) return
    setScrollLeft(
      hasOverflowX.value
        ? resolveCenteredScrollLeft({
            clientWidth: viewport.clientWidth,
            scrollWidth: viewport.scrollWidth
          })
        : 0
    )
  }

  function setScrollLeft(scrollLeft: number): void {
    const viewport = options.viewport.value
    if (!viewport) return
    viewport.scrollLeft = scrollLeft
    programmaticScrollLeft = viewport.scrollLeft
    lastObservedScrollLeft = viewport.scrollLeft
  }

  function onScroll(): void {
    const viewport = options.viewport.value
    if (
      viewport &&
      programmaticScrollLeft !== null &&
      Math.abs(viewport.scrollLeft - programmaticScrollLeft) <= 2
    ) {
      lastObservedScrollLeft = viewport.scrollLeft
      return
    }
    if (
      viewport &&
      lastObservedScrollLeft !== null &&
      Math.abs(viewport.scrollLeft - lastObservedScrollLeft) <= 2
    ) {
      return
    }
    programmaticScrollLeft = null
    lastObservedScrollLeft = viewport?.scrollLeft ?? null
    pendingCenterRatio = null
    userScrolledViewport.value = true
    layoutGeneration += 1
  }

  function resetUserScroll(): void {
    userScrolledViewport.value = false
    layoutGeneration += 1
  }

  function isStale(generation: number): boolean {
    return disposed || generation !== layoutGeneration
  }

  return {
    availableWidth,
    viewportMode,
    hasOverflowX,
    userScrolledViewport,
    scaleConfig,
    start,
    dispose,
    syncLayout,
    currentCenterRatio,
    onScroll,
    resetUserScroll
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
