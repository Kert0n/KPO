import { describe, expect, it } from 'vitest'
import { canUsePlayground, resolveDisplayLanguage } from '../codeBlockModel'

describe('codeBlockModel', () => {
  const languages = ['kotlin', 'go']

  it('uses author default before global language while block is untouched', () => {
    expect(resolveDisplayLanguage({
      languages,
      initialLanguage: 'go',
      authorDefaultLanguage: 'go',
      globalLanguage: 'kotlin',
      authorDefaultProtected: true
    })).toBe('go')
  })

  it('uses global language after author default is released by block click', () => {
    expect(resolveDisplayLanguage({
      languages,
      initialLanguage: 'go',
      authorDefaultLanguage: 'go',
      globalLanguage: 'kotlin',
      authorDefaultProtected: false
    })).toBe('kotlin')
  })

  it('keeps another untouched author default protected from global language', () => {
    expect(resolveDisplayLanguage({
      languages,
      initialLanguage: 'go',
      authorDefaultLanguage: 'go',
      globalLanguage: 'kotlin',
      authorDefaultProtected: true
    })).toBe('go')
  })

  it('uses global language immediately when author default is absent', () => {
    expect(resolveDisplayLanguage({
      languages,
      initialLanguage: 'kotlin',
      globalLanguage: 'go'
    })).toBe('go')
  })

  it('falls back when global language is unavailable in block', () => {
    expect(resolveDisplayLanguage({
      languages: ['kotlin'],
      initialLanguage: 'kotlin',
      globalLanguage: 'go'
    })).toBe('kotlin')
  })

  it('uses protected author default when global language is unavailable in block', () => {
    expect(resolveDisplayLanguage({
      languages: ['kotlin', 'go'],
      initialLanguage: 'kotlin',
      authorDefaultLanguage: 'go',
      globalLanguage: 'java',
      authorDefaultProtected: true
    })).toBe('go')
  })

  it('uses unsupported local language only for current block', () => {
    expect(resolveDisplayLanguage({
      languages: ['python', 'kotlin'],
      initialLanguage: 'kotlin',
      authorDefaultLanguage: 'kotlin',
      globalLanguage: 'go',
      authorDefaultProtected: false,
      localUnsupportedLanguage: 'python'
    })).toBe('python')
  })

  it('hard-disables playground when block disallows it', () => {
    expect(canUsePlayground({
      allowPlayground: false,
      displayLanguage: 'kotlin',
      hasKotlinCode: true
    })).toBe(false)
  })
})
