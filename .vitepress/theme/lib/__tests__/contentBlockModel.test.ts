import { describe, expect, it } from 'vitest'
import { getContentBlockContract, isWideContentBlock, ownsLocalOverflow } from '../contentBlockModel'

describe('contentBlockModel', () => {
  it('classifies tables as page-centered wide blocks with self-owned overflow', () => {
    expect(getContentBlockContract('table')).toMatchObject({
      lane: 'wide',
      canOverflow: true,
      overflowOwner: 'self',
      centerAgainst: 'page'
    })
    expect(isWideContentBlock('table')).toBe(true)
    expect(ownsLocalOverflow('table')).toBe(true)
  })

  it('classifies mermaid as a wide block with child viewport overflow', () => {
    expect(getContentBlockContract('mermaid')).toMatchObject({
      lane: 'wide',
      canOverflow: true,
      overflowOwner: 'child-viewport',
      centerAgainst: 'page'
    })
  })

  it('keeps warning and notes in the prose lane', () => {
    expect(getContentBlockContract('custom-container')).toMatchObject({
      lane: 'prose',
      canOverflow: false,
      overflowOwner: 'none',
      centerAgainst: 'prose'
    })
  })

  it('treats inline risk content as inline wrapping content', () => {
    expect(getContentBlockContract('inline-risk')).toMatchObject({
      lane: 'inline',
      canOverflow: false,
      overflowOwner: 'none'
    })
  })
})
