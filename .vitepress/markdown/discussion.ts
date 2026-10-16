import type MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import type Token from 'markdown-it/lib/token.mjs'
import { askAiBlockAttribute } from './askAiAnchors'

export const DISCUSSION_DEFAULT_TITLE = 'Дискуссионно'

/**
 * `::: discussion [collapsed] [Заголовок]` — место, где текст лекции сам говорит, что мнения,
 * школы или трактовки расходятся. Позицию лекции блок не меняет, только выделяет.
 *
 * Внешне это блок VitePress `important` (свои цвета для светлой и тёмной темы), класс
 * `discussion` — смысловой. `collapsed` сворачивает блок в <details>, как `::: details`;
 * в PDF такие блоки раскрываются вместе с остальными <details>.
 */
export function discussionPlugin(md: MarkdownIt): void {
  md.use(container, 'discussion', {
    render(tokens: Token[], index: number, _options: unknown, env: unknown) {
      const token = tokens[index]
      if (token.nesting === -1) {
        return isCollapsed(matchingOpen(tokens, index)) ? '</details>\n' : '</div>\n'
      }

      const { collapsed, title } = parseDiscussionInfo(token.info)
      const references = (env as { references?: unknown } | undefined)?.references
      const renderedTitle = md.renderInline(title, { references })
      const classes = 'important discussion custom-block'
      return collapsed
        ? `<details class="${classes}"${askAiBlockAttribute(token)}><summary>${renderedTitle}</summary>\n`
        : `<div class="${classes}"${askAiBlockAttribute(token)}><p class="custom-block-title">${renderedTitle}</p>\n`
    }
  })
}

export function parseDiscussionInfo(info: string): { collapsed: boolean; title: string } {
  const rest = info
    .trim()
    .replace(/^discussion\b/, '')
    .trim()
  const collapsed = /^collapsed(\s|$)/.test(rest)
  const title = (collapsed ? rest.replace(/^collapsed/, '') : rest).trim()
  return { collapsed, title: title || DISCUSSION_DEFAULT_TITLE }
}

function isCollapsed(open: Token | undefined): boolean {
  return open ? parseDiscussionInfo(open.info).collapsed : false
}

function matchingOpen(tokens: Token[], closeIndex: number): Token | undefined {
  const level = tokens[closeIndex].level
  for (let index = closeIndex - 1; index >= 0; index -= 1) {
    const candidate = tokens[index]
    if (candidate.type === 'container_discussion_open' && candidate.level === level)
      return candidate
  }
  return undefined
}
