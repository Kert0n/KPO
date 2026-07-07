import { createMarkdownRenderer } from 'vitepress'
import { describe, expect, it } from 'vitest'
import { applyMarkdownExtensions } from '..'

describe('math rendering', () => {
  it('renders display math inside VitePress custom containers', async () => {
    const md = await createMarkdownRenderer(process.cwd(), {
      math: true,
      config(md) {
        applyMarkdownExtensions(md)
      }
    })

    const html = md.render([
      '::: tip',
      'Пусть `φ(x)` — свойство, доказуемое для объектов `x` типа `T`.',
      '',
      '$$',
      '\\begin{aligned}',
      'S <: T',
      '&\\quad\\Longrightarrow\\quad',
      '(\\forall x : T,\\ \\varphi(x)) \\\\',
      '&\\quad\\Rightarrow\\quad',
      '(\\forall y : S,\\ \\varphi(y))',
      '\\end{aligned}',
      '$$',
      ':::'
    ].join('\n'))

    expect(html).toContain('class="tip custom-block"')
    expect(html).toContain('<mjx-container tabindex="0"')
    expect(html).toContain('data-mml-node="mtable"')
    expect(html).toContain('<mtable')
    expect(html).not.toContain('$$')
  })
})
