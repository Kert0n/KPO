import { describe, expect, it } from 'vitest'
import {
  isAnchorLayoutStable,
  isScrollIntentKey,
  resolveAnchoredScrollTop
} from '../viewportAnchor'

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
})
