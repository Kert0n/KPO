import { describe, expect, it } from 'vitest'
import { tokenizeSearchQuery } from '../searchResultHighlight'

describe('searchResultHighlight', () => {
  it('tokenizes query terms for page highlighting', () => {
    expect(tokenizeSearchQuery('  hasDiscount kotlin hasDiscount  a  ')).toEqual([
      'hasDiscount',
      'kotlin'
    ])
  })

  it('deduplicates terms case-insensitively', () => {
    expect(tokenizeSearchQuery('Proxy proxy PROXY repo')).toEqual(['Proxy', 'repo'])
  })

  it('ignores empty and one-character terms', () => {
    expect(tokenizeSearchQuery(' a  b  DI  ')).toEqual(['DI'])
  })
})
