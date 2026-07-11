import { describe, expect, it } from 'vitest'
import { resolveAnchoredScrollTop } from '../viewportAnchor'

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
})
