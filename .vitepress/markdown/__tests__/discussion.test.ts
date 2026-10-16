import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { askAiAnchorsPlugin } from '../askAiAnchors'
import { discussionPlugin, parseDiscussionInfo } from '../discussion'

function render(source: string): string {
  const md = new MarkdownIt()
  md.use(askAiAnchorsPlugin)
  md.use(discussionPlugin)
  return md.render(source)
}

describe('discussionPlugin', () => {
  it('renders an open block with the default title and an Ask AI anchor', () => {
    const html = render('::: discussion\nВокруг моков есть несколько школ.\n:::\n')

    expect(html).toContain('<div class="important discussion custom-block"')
    expect(html).toContain('<p class="custom-block-title">Дискуссионно</p>')
    expect(html).toContain('Вокруг моков есть несколько школ.')
    expect(html).toMatch(
      /<div class="important discussion custom-block" data-kpo-ask-block-id="[^"]+">/
    )
    expect(html.trim().endsWith('</div>')).toBe(true)
  })

  it('uses a custom title with inline markdown', () => {
    const html = render('::: discussion Что такое `MVC`\nТекст.\n:::\n')
    expect(html).toContain('<p class="custom-block-title">Что такое <code>MVC</code></p>')
  })

  it('collapses into details and closes the matching tag', () => {
    const html = render(
      '::: discussion collapsed Противоположная позиция\nПервый абзац.\n\nВторой.\n:::\n\nПосле.\n'
    )

    expect(html).toContain('<details class="important discussion custom-block"')
    expect(html).toContain('<summary>Противоположная позиция</summary>')
    expect(html).toContain('</details>')
    expect(html).not.toContain('custom-block-title')
    expect(html.indexOf('</details>')).toBeLessThan(html.indexOf('После.'))
  })

  it('parses the info string', () => {
    expect(parseDiscussionInfo('discussion')).toEqual({ collapsed: false, title: 'Дискуссионно' })
    expect(parseDiscussionInfo('discussion collapsed')).toEqual({
      collapsed: true,
      title: 'Дискуссионно'
    })
    expect(parseDiscussionInfo('discussion collapsedness of views')).toEqual({
      collapsed: false,
      title: 'collapsedness of views'
    })
  })
})
