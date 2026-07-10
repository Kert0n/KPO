import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { clamp } from '../../../shared/core/math'
import { CONTENT_LAYOUT_TOKENS } from '../../lib/contentLayoutTokens'
import {
  resolveCenteredScrollLeft,
  resolveMermaidOverflow,
  resolveScrollLeftForCenterRatio,
  type MermaidViewportMode
} from '../../lib/mermaidLayoutModel'
import { waitAnimationFrames } from '../../lib/viewportAnchor'

export function useMermaidViewport(root: Ref<HTMLElement | null>, viewport: Ref<HTMLElement | null>) {
  const availableWidth = ref<number | null>(null)
  const viewBoxWidth = ref<number | null>(null)
  const viewBoxHeight = ref<number | null>(null)
  const viewportMode = ref<MermaidViewportMode>('desktop')
  const hasOverflowX = ref(false)
  const hasOverflowY = ref(false)
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
  let isProgrammaticScroll = false
  let programmaticScrollLeft: number | null = null

  onMounted(() => {
    updateMeasurements()
    resizeObserver = new ResizeObserver(() => void syncViewportLayout())
    if (root.value) resizeObserver.observe(root.value)
    window.addEventListener('resize', onWindowResize)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    window.removeEventListener('resize', onWindowResize)
  })

  function updateMeasurements(): void {
    if (!root.value) return
    viewportMode.value = window.matchMedia('(max-width: 639px)').matches ? 'mobile' : 'desktop'
    const style = getComputedStyle(root.value)
    const inlinePadding = cssPixels(style.paddingLeft) + cssPixels(style.paddingRight)
    availableWidth.value = Math.max(0, root.value.clientWidth - inlinePadding)
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
      minHeight: cssNumber(style, '--kpo-mermaid-min-height', CONTENT_LAYOUT_TOKENS.mermaidMinHeight)
    }
  }

  async function syncViewportLayout(
    options: { forceCenter?: boolean; centerRatio?: number | null } = {}
  ): Promise<void> {
    await nextTick()
    await waitAnimationFrames(2)
    updateMeasurements()
    updateOverflowState()
    if (options.centerRatio !== undefined && options.centerRatio !== null) {
      restoreViewportCenterRatio(options.centerRatio)
    } else {
      centerViewportIfNeeded(Boolean(options.forceCenter))
    }
  }

  function updateOverflowState(): void {
    const element = viewport.value
    if (!element) {
      hasOverflowX.value = false
      hasOverflowY.value = false
      return
    }
    const state = resolveMermaidOverflow({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    })
    hasOverflowX.value = state.hasOverflowX
    hasOverflowY.value = state.hasOverflowY
  }

  function currentViewportCenterRatio(): number | null {
    const element = viewport.value
    if (!element || element.scrollWidth <= 0) return null
    return clamp((element.scrollLeft + element.clientWidth / 2) / element.scrollWidth, 0, 1)
  }

  function resetUserScroll(): void {
    userScrolledViewport.value = false
  }

  function onViewportScroll(): void {
    const element = viewport.value
    if (
      isProgrammaticScroll &&
      element &&
      programmaticScrollLeft !== null &&
      Math.abs(element.scrollLeft - programmaticScrollLeft) <= 2
    ) {
      return
    }
    isProgrammaticScroll = false
    programmaticScrollLeft = null
    userScrolledViewport.value = true
  }

  function centerViewportIfNeeded(force: boolean): void {
    const element = viewport.value
    if (!element || (!force && userScrolledViewport.value)) return
    setViewportScrollLeft(
      hasOverflowX.value
        ? resolveCenteredScrollLeft({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth
          })
        : 0
    )
  }

  function restoreViewportCenterRatio(centerRatio: number): void {
    const element = viewport.value
    if (!element) return
    setViewportScrollLeft(
      resolveScrollLeftForCenterRatio({
        centerRatio,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth
      })
    )
  }

  function setViewportScrollLeft(scrollLeft: number): void {
    const element = viewport.value
    if (!element) return
    isProgrammaticScroll = true
    element.scrollLeft = scrollLeft
    programmaticScrollLeft = element.scrollLeft
    window.requestAnimationFrame(() => {
      isProgrammaticScroll = false
      programmaticScrollLeft = null
    })
  }

  function onWindowResize(): void {
    void syncViewportLayout()
  }

  return {
    availableWidth,
    viewBoxWidth,
    viewBoxHeight,
    viewportMode,
    hasOverflowX,
    hasOverflowY,
    scaleConfig,
    syncViewportLayout,
    currentViewportCenterRatio,
    resetUserScroll,
    onViewportScroll
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
