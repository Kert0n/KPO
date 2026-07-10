import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { applyMarkdownExtensions } from '../../markdown'
import { getContentCatalog, getPdfPages, getUiSweepPages } from '../../shared/content/contentCatalog'
import { buildAskAiPrompt } from '../../shared/core/askAiModel'
import { SITE } from '../../shared/site'
import { buildAskAiPageContext, listAskAiContextEntries } from '../askAiContext'
import { getNav, getRewrites, getSidebar } from '../content'

describe('published contract characterization', () => {
  it('keeps catalog routes and channel inclusion stable', () => {
    const catalog = getContentCatalog()
    expect(
      catalog.pages.map(({ route, routeKey, kind, order, inclusion }) => ({
        route,
        routeKey,
        kind,
        order,
        inclusion
      }))
    ).toMatchSnapshot()
    expect(getUiSweepPages(catalog).map((page) => page.route)).toMatchSnapshot()
    expect(getPdfPages(catalog).map((page) => page.route)).toMatchSnapshot()
  })

  it('keeps navigation and rewrites stable', () => {
    expect(getNav()).toMatchSnapshot()
    expect(getSidebar()).toMatchSnapshot()
    expect(getRewrites()).toMatchSnapshot()
  })

  it('keeps Ask AI entries, block IDs and fixture prompt stable', () => {
    expect(listAskAiContextEntries()).toMatchSnapshot()

    const context = buildAskAiPageContext(
      {
        routeKey: 'service-pages/ui-contract',
        sourcePath: 'content/service-pages/ui-contract/vitepress.md'
      },
      { courseTitle: SITE.title, courseDescription: SITE.description }
    )
    expect(
      context.blocks.map(({ id, kind, language, lineStart, lineEnd }) => ({
        id,
        kind,
        language,
        lineStart,
        lineEnd
      }))
    ).toMatchSnapshot()

    const target = context.blocks.find((block) => block.kind === 'multi-code')
    if (!target) throw new Error('UI fixture must contain a multi-code Ask AI block')
    expect(
      buildAskAiPrompt({
        pageContext: context,
        selectedText: 'Fixture Kotlin',
        blockIds: [target.id],
        maxChars: 12_000
      })
    ).toMatchSnapshot()
  })

  it('keeps representative rendered HTML stable', () => {
    const markdown = new MarkdownIt({ html: true })
    applyMarkdownExtensions(markdown)
    const html = markdown.render(`# Заголовок

Обычный абзац.

![Схема](/diagram.svg)

| A | B |
|---|---|
| 1 | 2 |

\`\`\`kotlin
fun main() = println("ok")
\`\`\`

:::: multi-code "Пример" {default=kotlin}
\`\`\`kotlin
val answer = 42
\`\`\`
\`\`\`java
var answer = 42;
\`\`\`
::::`)

    expect(sanitizeHtml(html)).toMatchSnapshot()
  })
})

function sanitizeHtml(html: string): string {
  return html
    .replace(/data-v-[a-f0-9-]+/g, 'data-v-scope')
    .replace(/\s+style="[^"]*--shiki[^"]*"/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
