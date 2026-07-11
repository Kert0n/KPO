import { describe, expect, it } from 'vitest'
import { CONTENT_LAYOUT_TOKENS } from '../contentLayoutTokens'
import { resolveAdaptiveTableMode } from '../adaptiveTableModel'

describe('adaptiveTableModel', () => {
  it('keeps fitting tables in fit mode', () => {
    expect(
      resolveAdaptiveTableMode({
        containerWidth: 480,
        naturalTableWidth: 470,
        columnCount: 3,
        minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableMinReadableColumnWidth,
        epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
      })
    ).toBe('fit')
  })

  it('wraps wider tables when columns remain readable', () => {
    expect(
      resolveAdaptiveTableMode({
        containerWidth: 480,
        naturalTableWidth: 720,
        columnCount: 4,
        minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableMinReadableColumnWidth,
        epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
      })
    ).toBe('wrap')
  })

  it('can use the dense readable width as a lower runtime threshold', () => {
    expect(
      resolveAdaptiveTableMode({
        containerWidth: 366,
        naturalTableWidth: 677,
        columnCount: 4,
        minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableDenseMinColumnWidth,
        epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
      })
    ).toBe('wrap')
  })

  it('scrolls tables that are too dense to wrap readably', () => {
    expect(
      resolveAdaptiveTableMode({
        containerWidth: 480,
        naturalTableWidth: 960,
        columnCount: 6,
        minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableMinReadableColumnWidth,
        epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
      })
    ).toBe('scroll')
  })

  it('scrolls when column count cannot be determined', () => {
    expect(
      resolveAdaptiveTableMode({
        containerWidth: 480,
        naturalTableWidth: 720,
        columnCount: 0,
        minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableMinReadableColumnWidth,
        epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
      })
    ).toBe('scroll')
  })

  it('uses epsilon to prevent mode flicker around the container edge', () => {
    expect(
      resolveAdaptiveTableMode({
        containerWidth: 480,
        naturalTableWidth: 481,
        columnCount: 3,
        minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableMinReadableColumnWidth,
        epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
      })
    ).toBe('fit')
  })
})
