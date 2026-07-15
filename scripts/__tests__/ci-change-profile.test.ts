import { describe, expect, it } from 'vitest'
import { classifyChangedPaths, isContentPath, profileForEvent } from '../ci-change-profile.mts'

describe('CI change profiles', () => {
  it('classifies lecture text as content', () => {
    expect(classifyChangedPaths(['content/lectures/Lec4/vitepress.md'])).toBe('content')
  })

  it('classifies multiple content paths as content', () => {
    expect(
      classifyChangedPaths([
        'content/intro/vitepress.md',
        'content/lectures/Lec4/assets/slide.png',
        'content/conclusion/vitepress.md'
      ])
    ).toBe('content')
  })

  it('classifies changed and deleted lecture assets as content', () => {
    expect(classifyChangedPaths(['content/lectures/Lec14/assets/slide-063.png'])).toBe('content')
  })

  it.each([
    'content/home/vitepress.md',
    'content/intro/vitepress.md',
    'content/conclusion/vitepress.md',
    'content/extras/03/vitepress.md',
    'content/lectures/_template/README.md'
  ])('classifies %s as content', (path) => {
    expect(isContentPath(path)).toBe(true)
    expect(classifyChangedPaths([path])).toBe('content')
  })

  it.each([
    'content/service-pages/ui-contract/vitepress.md',
    '.vitepress/theme/index.ts',
    'package.json',
    '.github/workflows/quality.yml'
  ])('classifies %s as full', (path) => {
    expect(classifyChangedPaths([path])).toBe('full')
  })

  it('classifies unknown paths as full', () => {
    expect(classifyChangedPaths(['output/unknown.bin'])).toBe('full')
  })

  it('fails safely for empty changes and manual runs', () => {
    expect(classifyChangedPaths([])).toBe('full')
    expect(profileForEvent({ eventName: 'workflow_dispatch' })).toBe('full')
    expect(profileForEvent({ eventName: 'push', base: '', head: '' })).toBe('full')
  })
})
