import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { contentBlocksPlugin } from '../contentBlocks'
import { mermaidPlugin } from '../mermaid'
import { multiCodePlugin } from '../multiCode'

function render(markdown: string): string {
  const md = new MarkdownIt({ html: true })
  md.use(multiCodePlugin)
  md.use(mermaidPlugin)
  md.use(contentBlocksPlugin)
  return md.render(markdown)
}

describe('contentBlocksPlugin', () => {
  it('wraps markdown tables as wide self-scrolling content blocks', () => {
    const html = render('| A | B |\n| - | - |\n| 1 | 2 |\n')

    expect(html).toContain('kpo-content-block kpo-content-block--table kpo-content-block--wide')
    expect(html).toContain('<table>')
    expect(html).toContain('</table>\n</div>')
  })

  it('wraps standalone fences without wrapping multi-code fences', () => {
    const html = render([
      '```ts',
      'const value = 1',
      '```',
      '',
      '::: multi-code "Example"',
      '```kotlin',
      'val value = 1',
      '```',
      '```go',
      'value := 1',
      '```',
      ':::'
    ].join('\n'))

    expect(html.match(/kpo-content-block--code/g)).toHaveLength(1)
    expect(html).toContain('kpo-content-block--multi-code')
  })

  it('wraps image-only paragraphs and leaves normal paragraphs alone', () => {
    const html = render('![Slide](./slide.png)\n\nPlain paragraph.\n')

    expect(html).toContain('kpo-content-block kpo-content-block--image kpo-content-block--wide')
    expect(html).toContain('<p>Plain paragraph.</p>')
  })

  it('does not double-wrap mermaid fences', () => {
    const html = render('```mermaid\nflowchart LR\n  A --> B\n```\n')

    expect(html.match(/kpo-content-block--mermaid/g)).toHaveLength(1)
    expect(html).not.toContain('kpo-content-block--code')
  })
})
