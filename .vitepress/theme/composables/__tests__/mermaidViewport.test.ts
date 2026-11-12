import { shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMermaidViewport } from '../useMermaidViewport'

vi.mock('../../lib/viewportAnchor', () => ({
  waitAnimationFrames: vi.fn(async () => {})
}))

afterEach(() => vi.unstubAllGlobals())

function setup() {
  const element = Object.assign(new EventTarget(), {
    clientWidth: 300,
    scrollWidth: 900,
    scrollLeft: 0
  })
  const root = Object.assign(new EventTarget(), { clientWidth: 324 })
  const windowEvents = Object.assign(new EventTarget(), {
    matchMedia: () => ({ matches: false })
  })
  let resize = () => {}
  const disconnect = vi.fn()
  vi.stubGlobal('window', windowEvents)
  vi.stubGlobal('getComputedStyle', () => ({
    paddingLeft: '12px',
    paddingRight: '12px',
    getPropertyValue: () => ''
  }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback
      }
      observe = vi.fn()
      disconnect = disconnect
    }
  )
  const viewport = useMermaidViewport({
    root: shallowRef(root as unknown as HTMLElement),
    viewport: shallowRef(element as unknown as HTMLElement)
  })
  viewport.start()
  return { viewport, element, root, windowEvents, resize: () => resize(), disconnect }
}

describe('Mermaid viewport lifecycle', () => {
  it('discards a pending zoom position before recentering', async () => {
    const { viewport, element } = setup()
    const zoomLayout = viewport.syncLayout({ centerRatio: 0.2 })
    viewport.resetUserScroll()
    const resetLayout = viewport.syncLayout({ forceCenter: true })

    expect(await zoomLayout).toBe('stale')
    expect(await resetLayout).toBe('applied')
    expect(element.scrollLeft).toBe(300)
    expect(viewport.layoutSettled.value).toBe(true)
    viewport.dispose()
  })

  it('keeps wheel scrolling through layout and gives reset ownership of centering', async () => {
    const { viewport, element, root } = setup()
    await viewport.syncLayout()
    expect(viewport.availableWidth.value).toBe(300)
    root.dispatchEvent(new Event('wheel'))
    element.scrollLeft = 20
    viewport.onScroll()
    expect(viewport.userScrolledViewport.value).toBe(true)
    await viewport.syncLayout()
    expect(element.scrollLeft).toBe(20)

    viewport.resetUserScroll()
    await viewport.syncLayout({ forceCenter: true })
    expect(element.scrollLeft).toBe(300)
    expect(viewport.userScrolledViewport.value).toBe(false)
    viewport.dispose()
  })

  it('ignores late layout scroll events without giving them user ownership', async () => {
    const { viewport, element, root } = setup()
    await viewport.syncLayout()
    viewport.onScroll()
    element.scrollLeft = 40
    viewport.onScroll()
    root.dispatchEvent(new Event('wheel'))
    viewport.onScroll()
    expect(viewport.userScrolledViewport.value).toBe(false)
    await viewport.syncLayout()
    expect(element.scrollLeft).toBe(300)
    viewport.dispose()
  })

  it('recenters an unowned viewport synchronously during resize', async () => {
    const { viewport, element, resize } = setup()
    await viewport.syncLayout()
    element.clientWidth = 100
    resize()
    expect(element.scrollLeft).toBe(400)
    await viewport.syncLayout()
    expect(viewport.hasOverflowX.value).toBe(true)
    viewport.dispose()
  })

  it('preserves pointer scrolling when a resize arrives before its scroll event', async () => {
    const { viewport, element, root, windowEvents, resize } = setup()
    await viewport.syncLayout()
    root.dispatchEvent(new Event('pointerdown'))
    element.scrollLeft = 30
    resize()
    expect(viewport.userScrolledViewport.value).toBe(true)
    await viewport.syncLayout()
    expect(element.scrollLeft).toBe(30)
    windowEvents.dispatchEvent(new Event('pointerup'))
    viewport.dispose()
  })

  it('recognizes keyboard scrolling and keeps its center ratio on zoom', async () => {
    const { viewport, element, root } = setup()
    await viewport.syncLayout()
    root.dispatchEvent(Object.assign(new Event('keydown'), { key: 'ArrowRight' }))
    element.scrollLeft = 120
    viewport.onScroll()
    const ratio = viewport.currentCenterRatio()
    expect(ratio).toBe(0.3)
    element.scrollWidth = 1200
    await viewport.syncLayout({ centerRatio: ratio })
    expect(element.scrollLeft).toBe(210)
    viewport.dispose()
  })

  it('invalidates pending work on disposal and disconnects observers', async () => {
    const { viewport, element, disconnect } = setup()
    const layout = viewport.syncLayout({ centerRatio: 0.2 })
    viewport.dispose()
    expect(await layout).toBe('stale')
    expect(element.scrollLeft).toBe(0)
    expect(disconnect).toHaveBeenCalledOnce()
    expect(viewport.layoutSettled.value).toBe(true)
  })

  it('handles a viewport removed before layout completes', async () => {
    const viewport = useMermaidViewport({ root: shallowRef(null), viewport: shallowRef(null) })
    expect(viewport.currentCenterRatio()).toBeNull()
    viewport.onScroll()
    expect(await viewport.syncLayout()).toBe('applied')
    expect(viewport.hasOverflowX.value).toBe(false)
  })
})
