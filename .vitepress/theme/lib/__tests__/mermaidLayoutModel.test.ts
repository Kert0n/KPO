import { describe, expect, it } from 'vitest'
import {
  readSvgViewBox,
  resolveCenteredScrollLeft,
  resolveMermaidAutoScale,
  resolveMermaidManualScale,
  resolveMermaidOverflow,
  resolveMermaidRenderedWidth,
  resolveScrollLeftForCenterRatio,
  shouldShowMermaidToolbar
} from '../mermaidLayoutModel'

describe('mermaidLayoutModel', () => {
  it('keeps scale 1 when the diagram fits available width', () => {
    expect(resolveMermaidAutoScale({
      viewBoxWidth: 600,
      viewBoxHeight: 240,
      availableWidth: 800,
      minScale: 0.72,
      minHeight: 120
    })).toBe(1)
  })

  it('fits a slightly wider diagram to available width', () => {
    expect(resolveMermaidAutoScale({
      viewBoxWidth: 1000,
      viewBoxHeight: 240,
      availableWidth: 800,
      minScale: 0.72,
      minHeight: 120
    })).toBe(0.8)
  })

  it('clamps very wide desktop diagrams to readable minimum scale', () => {
    expect(resolveMermaidAutoScale({
      viewBoxWidth: 1800,
      viewBoxHeight: 240,
      availableWidth: 800,
      minScale: 0.72,
      minHeight: 120
    })).toBe(0.72)
  })

  it('uses mobile min width and min height for readability', () => {
    expect(resolveMermaidAutoScale({
      viewBoxWidth: 1800,
      viewBoxHeight: 80,
      availableWidth: 382,
      minScale: 0.4,
      minHeight: 120,
      minRenderedWidth: 680
    })).toBe(1.5)
  })

  it('clamps manual scale by viewport mode', () => {
    expect(resolveMermaidManualScale({
      currentScale: 0.55,
      delta: -0.2,
      mode: 'desktop'
    })).toBe(0.5)

    expect(resolveMermaidManualScale({
      currentScale: 0.4,
      delta: -0.2,
      mode: 'mobile'
    })).toBe(0.35)

    expect(resolveMermaidManualScale({
      currentScale: 1.45,
      delta: 0.2,
      mode: 'desktop'
    })).toBe(1.5)
  })

  it('resolves rendered width from viewBox and scale', () => {
    expect(resolveMermaidRenderedWidth(1206, 0.77)).toBe(929)
    expect(resolveMermaidRenderedWidth(null, 0.77)).toBeNull()
  })

  it('reads svg viewBox dimensions', () => {
    expect(readSvgViewBox('<svg viewBox="0 0 1206 222"></svg>')).toEqual({
      width: 1206,
      height: 222
    })
  })

  it('resolves local overflow state with an epsilon', () => {
    expect(resolveMermaidOverflow({
      clientWidth: 400,
      scrollWidth: 401,
      clientHeight: 200,
      scrollHeight: 201
    })).toEqual({
      hasOverflowX: false,
      hasOverflowY: false
    })

    expect(resolveMermaidOverflow({
      clientWidth: 400,
      scrollWidth: 430,
      clientHeight: 200,
      scrollHeight: 260
    })).toEqual({
      hasOverflowX: true,
      hasOverflowY: true
    })
  })

  it('centers local mermaid scroll when content overflows', () => {
    expect(resolveCenteredScrollLeft({ clientWidth: 400, scrollWidth: 400 })).toBe(0)
    expect(resolveCenteredScrollLeft({ clientWidth: 400, scrollWidth: 900 })).toBe(250)
  })

  it('preserves scroll center ratio after scale changes', () => {
    expect(resolveScrollLeftForCenterRatio({
      centerRatio: 0.5,
      clientWidth: 400,
      scrollWidth: 900
    })).toBe(250)

    expect(resolveScrollLeftForCenterRatio({
      centerRatio: 0,
      clientWidth: 400,
      scrollWidth: 900
    })).toBe(0)
  })

  it('shows toolbar only when useful or requested by interaction', () => {
    expect(shouldShowMermaidToolbar({
      hasOverflowX: false,
      hasOverflowY: false,
      hasManualScale: false,
      isHovered: false,
      isFocusWithin: false
    })).toBe(false)

    expect(shouldShowMermaidToolbar({
      hasOverflowX: true,
      hasOverflowY: false,
      hasManualScale: false,
      isHovered: false,
      isFocusWithin: false
    })).toBe(true)

    expect(shouldShowMermaidToolbar({
      hasOverflowX: false,
      hasOverflowY: false,
      hasManualScale: true,
      isHovered: false,
      isFocusWithin: false
    })).toBe(true)

    expect(shouldShowMermaidToolbar({
      hasOverflowX: false,
      hasOverflowY: false,
      hasManualScale: false,
      isHovered: true,
      isFocusWithin: false
    })).toBe(true)

    expect(shouldShowMermaidToolbar({
      hasOverflowX: false,
      hasOverflowY: false,
      hasManualScale: false,
      isHovered: false,
      isFocusWithin: true
    })).toBe(true)
  })
})
