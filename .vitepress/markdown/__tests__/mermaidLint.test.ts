import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import MarkdownIt from 'markdown-it'
import { describe, expect, it } from 'vitest'
import { lintMermaidCode, mermaidPlugin } from '../mermaid'

function extractMermaidBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1])
}

function markdownFiles(directory: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...markdownFiles(path))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path)
  }

  return files
}

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

  it('accepts quoted labels with parens', () => {
    expect(lintMermaidCode('flowchart TD\n  Node["Method(x)"] --> Other[Ok]')).toEqual([])
  })

  it('accepts mermaid database shape labels', () => {
    expect(lintMermaidCode('flowchart TD\n  DB[(Database)] --> Cache[(orders + lines JSON)]')).toEqual([])
  })

  it('all lecture and extra mermaid fences pass lint', () => {
    const files = [...markdownFiles('lectures'), ...markdownFiles('extras')]
    const failures: string[] = []

    for (const file of files) {
      const blocks = extractMermaidBlocks(readFileSync(file, 'utf8'))
      for (const [index, block] of blocks.entries()) {
        const diagnostics = lintMermaidCode(block)
        if (diagnostics.length > 0) {
          failures.push(`${file}#${index + 1}: ${diagnostics[0].message}`)
        }
      }
    }

    expect(failures).toEqual([])
  })
})
