import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')

function readThemeCss(): string {
  const indexPath = resolve(root, '.vitepress/theme/styles/index.css')
  const index = readFileSync(indexPath, 'utf8')
  return [...index.matchAll(/@import\s+['"](.+?)['"];/g)]
    .map((match) => readFileSync(resolve(dirname(indexPath), match[1]), 'utf8'))
    .join('\n')
}

describe('Mermaid horizontal-only contract', () => {
  it('declares horizontal scrolling, visible vertical overflow and no height cap', () => {
    const css = readThemeCss()
    const viewportRule = css.match(/\.kpo-mermaid__viewport\s*\{([^}]+)\}/)?.[1] ?? ''

    expect(viewportRule).toContain('overflow-x: auto;')
    expect(viewportRule).toContain('overflow-y: visible;')
    expect(viewportRule).toContain('max-height: none;')
    expect(css).not.toContain('--kpo-mermaid-max-mobile-height')
    expect(css).not.toMatch(/\.kpo-mermaid__viewport\s*\{[^}]*max-height:\s*70vh/s)
  })

  it('keeps Mermaid source exclusively in the error fallback', () => {
    const component = readFileSync(
      resolve(root, '.vitepress/theme/components/MermaidDiagram.vue'),
      'utf8'
    )
    const template = component.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? ''
    const success = template.match(/<div v-if="svg"[\s\S]*?<div v-else-if="failed"/)?.[0] ?? ''
    const error = template.match(/<div v-else-if="failed"[\s\S]*?<div v-else/)?.[0] ?? ''

    expect(success).not.toContain('<details')
    expect(success).not.toContain('kpo-mermaid__source')
    expect(error).toContain('<details class="kpo-mermaid__source">')
    expect(error).toContain('<pre class="kpo-mermaid__fallback">{{ decodedCode }}</pre>')
  })
})
