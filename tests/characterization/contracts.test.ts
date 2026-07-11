import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import { buildAskAiPageContext, listAskAiContextEntries } from '../../.vitepress/lib/askAiContext'
import { getNav, getRewrites, getSidebar } from '../../.vitepress/lib/content'
import { contentPagesFor, getContentCatalog } from '../../.vitepress/shared/content/contentCatalog'
import { buildPdfPagePlan } from '../../.vitepress/shared/content/contentPolicy'
import { buildAskAiPrompt } from '../../.vitepress/theme/lib/askAiModel'

const root = resolve(import.meta.dirname, '../..')
const course = {
  root,
  courseTitle: 'Конструирование ПО',
  courseDescription: 'Конспект лекций по архитектуре приложений и инженерным практикам'
}

describe('stable public contracts', () => {
  test('routes, nav, sidebar and rewrites remain stable', () => {
    expect({
      nav: getNav(),
      sidebar: getSidebar(),
      rewrites: getRewrites()
    }).toMatchSnapshot()
  })

  test('PDF routes come from the catalog', () => {
    expect(buildPdfPagePlan(contentPagesFor('pdf'))).toMatchSnapshot()
  })

  test('content catalog channels and metadata remain explicit', () => {
    expect(
      getContentCatalog().map((page) => ({
        kind: page.kind,
        route: page.route,
        sourcePath: page.sourcePath,
        order: page.order,
        title: page.title,
        inclusion: page.inclusion
      }))
    ).toMatchSnapshot()
  })

  test('Ask AI context routes, block IDs and representative prompt remain stable', () => {
    const entries = listAskAiContextEntries(root)
    expect(entries).toMatchSnapshot('context entries')

    const fixtureEntry = entries.find((entry) => entry.routeKey === 'lectures/10')
    expect(fixtureEntry).toBeDefined()
    const context = buildAskAiPageContext(fixtureEntry!, course)
    expect(
      context.blocks.map(({ id, kind, language, lineStart, lineEnd }) => ({
        id,
        kind,
        language: language ?? null,
        lineStart,
        lineEnd
      }))
    ).toMatchSnapshot('lecture 10 block IDs')

    const target = context.blocks.find((block) => block.markdown.includes('RESTful API'))
    expect(target).toBeDefined()
    expect(
      buildAskAiPrompt({
        pageContext: context,
        selectedText: 'RESTful API',
        blockIds: [target!.id],
        maxChars: 12_000
      })
    ).toMatchSnapshot('representative Ask AI prompt')
  })

  test('storage keys and literal values remain stable', () => {
    const files = walk(join(root, '.vitepress'))
      .filter((file) => /\.(?:ts|vue|mts)$/.test(file))
      .filter((file) => !file.includes('/dist/') && !file.includes('/cache/'))
    const literals = new Set<string>()
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/['"]((?:kpo:|vitepress-theme-)[a-z0-9:-]+)['"]/gi)) {
        literals.add(match[1])
      }
    }
    expect([...literals].sort()).toMatchSnapshot()
  })
})

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
