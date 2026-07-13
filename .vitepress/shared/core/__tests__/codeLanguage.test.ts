import { describe, expect, it } from 'vitest'
import {
  canUsePlayground,
  isSupportedCodeLanguage,
  normalizeLanguage,
  parseCsv,
  resolveDisplayLanguage
} from '../codeLanguage'

describe('code language fixture policy', () => {
  it('normalizes aliases and parses fixture language lists', () => {
    expect(normalizeLanguage('C# active')).toBe('csharp')
    expect(parseCsv('kotlin, java, ,go')).toEqual(['kotlin', 'java', 'go'])
    expect(isSupportedCodeLanguage('go')).toBe(true)
    expect(isSupportedCodeLanguage('rust')).toBe(false)
  })

  it('resolves available display and Playground languages', () => {
    expect(resolveDisplayLanguage({ languages: ['kotlin', 'java'], globalLanguage: 'java' })).toBe(
      'java'
    )
    expect(
      canUsePlayground({
        allowPlayground: true,
        displayLanguage: 'kotlin',
        hasKotlinCode: true
      })
    ).toBe(true)
    expect(
      canUsePlayground({
        allowPlayground: true,
        displayLanguage: 'java',
        hasKotlinCode: true
      })
    ).toBe(false)
  })
})
