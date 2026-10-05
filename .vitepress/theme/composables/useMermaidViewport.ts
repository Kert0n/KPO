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

/**
 * Сколько миллисекунд после колеса, касания или клавиши прокрутка вьюпорта
 * считается пользовательской. Покрывает инерционную и плавную прокрутку.
 */
const USER_SCROLL_INTENT_MS = 1000
const SCROLL_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  ' '
])

export function useMermaidViewport(options: {
  root: Ref<HTMLElement | null>
  viewport: Ref<HTMLElement | null>
}) {
  const availableWidth = ref<number | null>(null)
  const viewportMode = ref<MermaidViewportMode>('desktop')
  const hasOverflowX = ref(false)
  const userScrolledViewport = ref(false)
  /**
   * false, пока хотя бы один syncLayout в полёте. Появления SVG в DOM
   * недостаточно, чтобы считать диаграмму готовой: между ним и применённой
   * раскладкой лежат nextTick и два кадра, за которые пересчитываются масштаб
   * и центровка. Скриншот, снятый в этом окне, поймает промежуточное состояние.
   */
  const layoutSettled = ref(false)
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
  let pendingLayouts = 0
  /**
   * Браузер сам двигает scrollLeft, когда меняется раскладка: при ресайзе окна,
   * повороте телефона, полностраничном скриншоте. Такой scroll event неотличим
   * от пользовательского по самому событию, поэтому владение вьюпортом отдаём
   * только при недавнем вводе внутри диаграммы: колесо, касание, указатель
   * (в том числе на полосе прокрутки) или клавиша прокрутки.
   */
  let lastUserIntentAt = Number.NEGATIVE_INFINITY
  let pointerActive = false
  let intentRoot: HTMLElement | null = null

  function start(): void {
    disposed = false
    updateMeasurements()
    resizeObserver = new ResizeObserver(() => {
      reconcileResizeImmediately()
      void syncLayout()
    })
    if (options.root.value) resizeObserver.observe(options.root.value)
    listenForUserIntent(options.root.value)
  }

  function dispose(): void {
    disposed = true
    layoutGeneration += 1
    resizeObserver?.disconnect()
    resizeObserver = null
    listenForUserIntent(null)
    programmaticScrollLeft = null
    lastObservedScrollLeft = null
    pendingCenterRatio = null
  }

  async function syncLayout(
    syncOptions: { forceCenter?: boolean; centerRatio?: number | null } = {}
  ): Promise<MermaidLayoutResult> {
    // Счётчик, а не флаг: ResizeObserver умеет запустить второй проход, пока
    // первый ещё идёт. Раскладка считается устоявшейся, когда завершился
    // последний из них.
    pendingLayouts += 1
    layoutSettled.value = false
    try {
      return await runLayout(syncOptions)
    } finally {
      pendingLayouts -= 1
      if (pendingLayouts === 0) layoutSettled.value = true
    }
  }

  async function runLayout(syncOptions: {
    forceCenter?: boolean
    centerRatio?: number | null
  }): Promise<MermaidLayoutResult> {
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

  function reconcileResizeImmediately(): void {
    const viewport = options.viewport.value
    if (!viewport) return

    // ResizeObserver runs before paint. Keep an unowned viewport centered for that
    // paint as well; syncLayout verifies the settled geometry on the following frames.
    if (lastObservedScrollLeft !== null && hasRecentUserIntent()) {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      const expectedScrollLeft = clamp(lastObservedScrollLeft, 0, maxScrollLeft)
      if (Math.abs(viewport.scrollLeft - expectedScrollLeft) > 2) {
        claimUserScroll(viewport)
        return
      }
    }

    if (userScrolledViewport.value) return
    const overflow = resolveMermaidOverflow({
      clientWidth: viewport.clientWidth,
      scrollWidth: viewport.scrollWidth
    })
    setScrollLeft(
      overflow.hasOverflowX
        ? resolveCenteredScrollLeft({
            clientWidth: viewport.clientWidth,
            scrollWidth: viewport.scrollWidth
          })
        : 0
    )
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
    if (!viewport) return
    if (!hasRecentUserIntent()) {
      // Сдвиг от раскладки, а не от читателя: центровку вернёт ближайший syncLayout.
      lastObservedScrollLeft = viewport.scrollLeft
      return
    }
    claimUserScroll(viewport)
  }

  function hasRecentUserIntent(): boolean {
    return pointerActive || performance.now() - lastUserIntentAt <= USER_SCROLL_INTENT_MS
  }

  function markUserIntent(): void {
    lastUserIntentAt = performance.now()
  }

  function onPointerDown(): void {
    pointerActive = true
    markUserIntent()
    window.addEventListener('pointerup', onPointerEnd, { once: true })
    window.addEventListener('pointercancel', onPointerEnd, { once: true })
  }

  function onPointerEnd(): void {
    pointerActive = false
    markUserIntent()
    window.removeEventListener('pointerup', onPointerEnd)
    window.removeEventListener('pointercancel', onPointerEnd)
  }

  function onKeydown(event: KeyboardEvent): void {
    if (SCROLL_KEYS.has(event.key)) markUserIntent()
  }

  function listenForUserIntent(root: HTMLElement | null): void {
    if (intentRoot) {
      intentRoot.removeEventListener('wheel', markUserIntent)
      intentRoot.removeEventListener('touchstart', markUserIntent)
      intentRoot.removeEventListener('touchmove', markUserIntent)
      intentRoot.removeEventListener('pointerdown', onPointerDown)
      intentRoot.removeEventListener('keydown', onKeydown)
      onPointerEnd()
    }
    intentRoot = root
    if (!root) return
    root.addEventListener('wheel', markUserIntent, { passive: true })
    root.addEventListener('touchstart', markUserIntent, { passive: true })
    root.addEventListener('touchmove', markUserIntent, { passive: true })
    root.addEventListener('pointerdown', onPointerDown, { passive: true })
    root.addEventListener('keydown', onKeydown)
  }

  function claimUserScroll(viewport: HTMLElement): void {
    programmaticScrollLeft = null
    lastObservedScrollLeft = viewport.scrollLeft
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
    layoutSettled,
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
