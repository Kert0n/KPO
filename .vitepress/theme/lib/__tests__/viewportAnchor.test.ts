import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  captureViewportAnchor,
  isAnchorLayoutStable,
  isScrollIntentKey,
  measureAnchorLayout,
  preserveViewportAnchor,
  restoreViewportAnchor,
  resolveAnchoredScrollTop,
  waitAnimationFrames
} from '../viewportAnchor'

const scrollTo = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', {
    scrollY: 200,
    innerHeight: 800,
    scrollTo,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    },
    cancelAnimationFrame: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })
  vi.stubGlobal('document', {
    documentElement: { scrollHeight: 1800 },
    body: { scrollHeight: 1700 }
  })
  scrollTo.mockReset()
})

afterEach(() => vi.unstubAllGlobals())

describe('viewportAnchor', () => {
  it('preserves viewport position relative to the anchored root', () => {
    expect(
      resolveAnchoredScrollTop({
        relativeViewportTop: -130,
        newRootTop: 800,
        maxScrollY: 2000
      })
    ).toBe(670)
  })

  it('clamps the target to the top of the document', () => {
    expect(
      resolveAnchoredScrollTop({
        relativeViewportTop: -500,
        newRootTop: 200,
        maxScrollY: 2000
      })
    ).toBe(0)
  })

  it('clamps the target to the bottom of the document', () => {
    expect(
      resolveAnchoredScrollTop({
        relativeViewportTop: 300,
        newRootTop: 1900,
        maxScrollY: 2000
      })
    ).toBe(2000)
  })

  it('distinguishes stable geometry from a late async expansion', () => {
    const previous = { rootTop: 800, rootHeight: 300, documentHeight: 2400 }
    expect(isAnchorLayoutStable(previous, { ...previous, rootHeight: 300.5 })).toBe(true)
    expect(isAnchorLayoutStable(previous, { ...previous, documentHeight: 2800 })).toBe(false)
  })

  it('treats future Home and End presses as scroll intent', () => {
    expect(isScrollIntentKey('Home')).toBe(true)
    expect(isScrollIntentKey('End')).toBe(true)
    expect(isScrollIntentKey('ArrowRight')).toBe(false)
  })

  it('captures, measures and restores a connected element anchor', () => {
    const root = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 300, height: 240 })
    } as HTMLElement
    const anchor = captureViewportAnchor(root)
    expect(anchor.relativeViewportTop).toBe(-300)
    expect(measureAnchorLayout(root)).toEqual({
      rootTop: 500,
      rootHeight: 240,
      documentHeight: 1800
    })

    restoreViewportAnchor(anchor)
    expect(scrollTo).toHaveBeenCalledWith({ top: 200, behavior: 'auto' })
  })

  it('runs anchored mutations and frame waits without browser-only observers', async () => {
    const root = {
      isConnected: true,
      getBoundingClientRect: () => ({ top: 100, height: 100 })
    } as HTMLElement
    const mutate = vi.fn()

    await preserveViewportAnchor(root, mutate)
    await waitAnimationFrames(2)

    expect(mutate).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalled()
  })

  it('falls back to the mutation when no anchor root exists', async () => {
    const mutate = vi.fn()
    await preserveViewportAnchor(null, mutate)
    expect(mutate).toHaveBeenCalledOnce()
  })
})
