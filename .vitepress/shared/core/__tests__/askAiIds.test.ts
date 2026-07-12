import { readFileSync } from 'node:fs'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import { createAskAiBlockId } from '../askAiIds'
import { migratedDefaultKotlinCompatibilityEntries } from '../askAiLegacyIds'

describe('Ask AI legacy block IDs', () => {
  it('preserves every default=kotlin migration without freezing changed content', () => {
    const entries = migratedDefaultKotlinCompatibilityEntries()
    expect(entries).toHaveLength(80)

    for (const entry of entries) {
      const separator = entry.key.lastIndexOf(':')
      const sourcePath = entry.key.slice(0, separator)
      const lineStart = Number(entry.key.slice(separator + 1))
      const migrated = multiCodeAt(sourcePath, lineStart)
      const original = restoreDefaultKotlin(migrated)

      expect(createAskAiBlockId('multi-code', migrated, lineStart, sourcePath)).toBe(entry.legacyId)
      expect(createAskAiBlockId('multi-code', original, lineStart, sourcePath)).toBe(entry.legacyId)
      expect(
        createAskAiBlockId('multi-code', `${migrated}\nchanged`, lineStart, sourcePath)
      ).not.toBe(entry.legacyId)
    }
  })

  it('normalizes VitePress absolute paths to content paths', () => {
    const sourcePath = 'content/lectures/Lec10/vitepress.md'
    const markdown = multiCodeAt(sourcePath, 486)
    expect(createAskAiBlockId('multi-code', markdown, 486, `/workspace/KPO/${sourcePath}`)).toBe(
      'kpo-ai-486-multi-code-10bb9h3'
    )
  })
})

function multiCodeAt(sourcePath: string, lineStart: number): string {
  const lines = matter(readFileSync(sourcePath, 'utf8')).content.replace(/\r\n?/g, '\n').split('\n')
  const start = lineStart - 1
  const delimiter = lines[start].match(/^(:{3,})/)?.[1]
  if (!delimiter) throw new Error(`Missing multi-code at ${sourcePath}:${lineStart}`)

  let end = start + 1
  while (end < lines.length && lines[end].trim() !== delimiter) end += 1
  if (end >= lines.length) throw new Error(`Unclosed multi-code at ${sourcePath}:${lineStart}`)
  return lines.slice(start, end).join('\n').trim()
}

function restoreDefaultKotlin(markdown: string): string {
  return markdown.replace(
    /^(:{3,}\s+multi-code[^\n]*?)(?:\s+\{([^}]*)\})?$/m,
    (_all, head, raw) => {
      const options = ['default=kotlin', String(raw ?? '').trim()].filter(Boolean).join(' ')
      return `${head} {${options}}`
    }
  )
}
