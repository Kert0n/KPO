import { describe, expect, it } from 'vitest'
import {
  assertMarkdownRouteContract,
  classifyMarkdownPath,
  unexpectedMarkdownPaths
} from '../contentContract'

describe('content contract', () => {
  it('accepts public folder pages', () => {
    expect(classifyMarkdownPath('content/home/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/intro/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/conclusion/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/lectures/Lec1/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/lectures/Lec14/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/extras/index/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/extras/01/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/extras/02/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/service-pages/ui-contract/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/service-pages/sidebar-contract/vitepress.md')).toBe('site')
    expect(classifyMarkdownPath('content/service-pages/visual-components/vitepress.md')).toBe(
      'site'
    )
  })

  it('accepts documented internal markdown', () => {
    expect(classifyMarkdownPath('README.md')).toBe('internal')
    expect(classifyMarkdownPath('content/lectures/_template/README.md')).toBe('internal')
    expect(classifyMarkdownPath('content/lectures/_template/vitepress.md')).toBe('internal')
    expect(classifyMarkdownPath('content/extras/_template/README.md')).toBe('internal')
    expect(classifyMarkdownPath('content/extras/_template/vitepress.md')).toBe('internal')
    expect(
      classifyMarkdownPath('content/service-pages/_internal/editorial-rubric/vitepress.md')
    ).toBe('internal')
  })

  it('rejects old root and flat content locations', () => {
    expect(
      unexpectedMarkdownPaths([
        'intro.md',
        'conclusion.md',
        'index.md',
        'lectures/Lec1/vitepress.md',
        'extras/01.md',
        'review/editorial-rubric.md',
        'test-fixtures/ui-contract.md',
        'content/draft.md',
        'content/extras/02.md',
        'content/lectures/notes.md'
      ])
    ).toEqual([
      'conclusion.md',
      'content/draft.md',
      'content/extras/02.md',
      'content/lectures/notes.md',
      'extras/01.md',
      'index.md',
      'intro.md',
      'lectures/Lec1/vitepress.md',
      'review/editorial-rubric.md',
      'test-fixtures/ui-contract.md'
    ])
  })

  it('throws a readable contract error', () => {
    expect(() =>
      assertMarkdownRouteContract(['README.md', 'content/home/vitepress.md', 'draft.md'])
    ).toThrow(/draft\.md/)
  })
})
