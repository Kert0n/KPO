import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { buildAskAiPageContext } from '../../.vitepress/lib/askAiContext'
import { buildNav, buildRewrites, buildSidebar } from '../../.vitepress/lib/content'
import { buildPdfPagePlan } from '../../.vitepress/shared/content/contentPolicy'
import type { ContentPage } from '../../.vitepress/shared/content/contentTypes'
import { SITE } from '../../.vitepress/shared/site'
import { buildAskAiPrompt } from '../../.vitepress/theme/lib/askAiModel'

const root = resolve(import.meta.dirname, '../..')
const pages = fixturePages()

describe('fixture-backed public contracts', () => {
  test('builds routes, navigation, sidebar and rewrites from injected catalog data', () => {
    expect(buildNav(pages)).toEqual([
      { text: 'Введение', link: '/intro' },
      { text: 'Лекции', link: '/lectures/01', activeMatch: '^/lectures/' },
      { text: 'Дополнения', link: '/extras/', activeMatch: '^/extras/' },
      { text: 'Заключение', link: '/conclusion' }
    ])
    expect(buildSidebar(pages)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'Лекции' }),
        expect.objectContaining({ text: 'Дополнения' })
      ])
    )
    expect(buildRewrites(pages)).toEqual({
      'intro/vitepress.md': 'intro.md',
      'lectures/Fixture1/vitepress.md': 'lectures/01.md',
      'extras/index/vitepress.md': 'extras/index.md',
      'extras/Fixture1/vitepress.md': 'extras/01.md',
      'conclusion/vitepress.md': 'conclusion.md'
    })
  })

  test('builds the PDF plan from fixture catalog entries only', () => {
    expect(buildPdfPagePlan(pages)).toEqual([
      { route: 'intro', file: '001-intro' },
      { route: 'lectures/01', file: '002-lecture-01' },
      { route: 'extras/', file: '003-extras' },
      { route: 'extras/01', file: '004-playground' },
      { route: 'conclusion', file: '005-conclusion' }
    ])
  })

  test('keeps fixture Ask AI block identities and injected element prompt semantics stable', () => {
    const context = buildAskAiPageContext(
      {
        routeKey: 'service-pages/ask-ai-contract',
        sourcePath: 'content/service-pages/ask-ai-contract/vitepress.md'
      },
      { root, courseTitle: 'Fixture course', courseDescription: 'Fixture description' }
    )
    const target = context.blocks.find((block) => block.kind === 'multi-code')
    expect(target).toBeDefined()
    expect(new Set(context.blocks.map((block) => block.id)).size).toBe(context.blocks.length)

    const prompt = buildAskAiPrompt({
      pageContext: context,
      selectedText: 'val selectedLanguage = "kotlin-visible-only"',
      blockIds: [target!.id],
      currentOverride: {
        kind: 'code',
        language: 'kotlin',
        markdown: '```kotlin\nval selectedLanguage = "kotlin-visible-only"\n```'
      },
      maxChars: 12_000
    })
    expect(prompt).toContain('Context before the multi-code fixture.')
    expect(prompt).toContain('Context after the multi-code fixture.')
    expect(prompt).not.toContain('csharp-hidden-variant')
  })

  test('keeps storage keys explicit', () => {
    expect(SITE.storageKeys).toEqual({
      codeLanguage: 'kpo:code-language',
      playgroundMode: 'kpo:playground-mode',
      askAiProvider: 'kpo:ask-ai-provider',
      appearance: 'vitepress-theme-appearance'
    })
  })
})

function fixturePages(): ContentPage[] {
  const inclusion = {
    nav: true,
    sidebar: true,
    search: true,
    askAi: true,
    pdf: true,
    uiSweep: true,
    sitemap: true
  }
  return [
    page('intro', 'root', '/intro', 'content/intro/vitepress.md', 'intro.md', 0, 'Intro'),
    page(
      'lecture',
      'lectures',
      '/lectures/01',
      'content/lectures/Fixture1/vitepress.md',
      'lectures/01.md',
      1,
      'Fixture lecture'
    ),
    page(
      'extras-index',
      'extras',
      '/extras/',
      'content/extras/index/vitepress.md',
      'extras/index.md',
      0,
      'Extras'
    ),
    page(
      'extra',
      'extras',
      '/extras/01',
      'content/extras/Fixture1/vitepress.md',
      'extras/01.md',
      1,
      'Fixture extra'
    ),
    page(
      'conclusion',
      'root',
      '/conclusion',
      'content/conclusion/vitepress.md',
      'conclusion.md',
      100,
      'Conclusion'
    )
  ].map((item) => ({ ...item, inclusion: { ...inclusion } }))
}

function page(
  kind: ContentPage['kind'],
  section: ContentPage['section'],
  route: string,
  sourcePath: string,
  outputPath: string,
  order: number,
  title: string
): ContentPage {
  return {
    kind,
    section,
    route,
    routeKey: route.replace(/^\//, '').replace(/\/$/, '/index'),
    sourcePath,
    outputPath,
    order,
    title,
    description: 'Fixture description',
    inclusion: {} as ContentPage['inclusion']
  }
}
