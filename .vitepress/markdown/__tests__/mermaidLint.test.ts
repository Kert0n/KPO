import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { lintMermaidCode, mermaidPlugin } from '../mermaid'

describe('mermaid lint', () => {
  it('wraps rendered diagrams as wide blocks', () => {
    const md = new MarkdownIt()
    md.use(mermaidPlugin)

    const html = md.render('```mermaid\nflowchart LR\n  A --> B\n```\n')

    expect(html).toContain('kpo-content-block--mermaid')
    expect(html).toContain('kpo-wide-block--mermaid')
    expect(html).toContain('<MermaidDiagram')
  })

  it('catches unquoted labels with parens', () => {
    expect(lintMermaidCode('flowchart TD\n  Node[Method(x)] --> Other[Ok]')).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining('Method(x)')
      })
    ])
  })

  it('rejects ELK layouts, which are not bundled', () => {
    expect(lintMermaidCode('---\nconfig:\n  layout: elk\n---\nflowchart LR\n  A --> B')).toEqual([
      expect.objectContaining({ line: 3, message: expect.stringContaining('ELK') })
    ])
    expect(lintMermaidCode('flowchart-elk TD\n  A --> B')).toEqual([
      expect.objectContaining({ line: 1, message: expect.stringContaining('ELK') })
    ])
    expect(
      lintMermaidCode('%%{init: {"layout": "elk.stress"}}%%\nflowchart LR\n  A --> B')
    ).toEqual([expect.objectContaining({ line: 1 })])
    expect(lintMermaidCode('flowchart LR\n  A["layout: dagre"] --> B')).toEqual([])
  })

  it('accepts quoted labels with parens', () => {
    expect(lintMermaidCode('flowchart TD\n  Node["Method(x)"] --> Other[Ok]')).toEqual([])
  })

  it('accepts mermaid database shape labels', () => {
    expect(
      lintMermaidCode('flowchart TD\n  DB[(Database)] --> Cache[(orders + lines JSON)]')
    ).toEqual([])
  })

  it('rejects classDiagram inheritance arrows inside flowchart', () => {
    expect(lintMermaidCode('flowchart LR\n  A <|.. B')).toEqual([
      expect.objectContaining({
        line: 2,
        message: expect.stringContaining('classDiagram')
      })
    ])
  })
})
