import { readFileSync } from 'node:fs'
import matter from 'gray-matter'
import { describe, expect, it } from 'vitest'
import {
  canonicalizeAskAiBlockIdentity,
  canonicalizeMultiCodeIdentity,
  createAskAiBlockId,
  createAskAiBlockIdAllocator
} from '../askAiIds'
import { publishedAskAiCompatibilityEntries } from '../askAiLegacyIds'
import { buildAskAiPageContext, listAskAiContextEntries } from '../../../lib/askAiContext'

describe('Ask AI semantic IDs', () => {
  it('keeps the published compatibility manifest complete', () => {
    const entries = publishedAskAiCompatibilityEntries()
    expect(entries).toHaveLength(2818)
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length)

    const sourceScopedIds = entries.map((entry) => {
      const sourceIdentity = entry.key.split(':', 1)[0]
      return `${sourceIdentity}:${entry.legacyId}`
    })
    expect(new Set(sourceScopedIds).size).toBe(entries.length)
  })

  it('maps every current published block to its published ID', () => {
    const actualIds = listAskAiContextEntries()
      .flatMap(
        (entry) =>
          buildAskAiPageContext(entry, {
            courseTitle: 'Course',
            courseDescription: 'Description'
          }).blocks
      )
      .map((block) => block.id)
      .sort()
    const publishedIds = publishedAskAiCompatibilityEntries()
      .map((entry) => entry.legacyId)
      .sort()

    expect(actualIds).toEqual(publishedIds)
  })

  it('keeps unpublished service fixture IDs on the legacy format', () => {
    const sourcePath = 'content/service-pages/ui-contract/vitepress.md'
    const ids = createAskAiBlockIdAllocator(sourcePath)
    const actualIds = multiCodeBlocks(sourcePath).map(({ markdown, lineStart }) =>
      ids.next('multi-code', markdown, lineStart)
    )
    expect(actualIds).toEqual([
      'kpo-ai-9-multi-code-gulv95',
      'kpo-ai-29-multi-code-iu82s1',
      'kpo-ai-49-multi-code-1ev2dw3',
      'kpo-ai-71-multi-code-1ilfomi',
      'kpo-ai-93-multi-code-cmvd02',
      'kpo-ai-125-multi-code-1peu7ph'
    ])
  })

  it('keeps a published ID through presentation-only changes and line moves', () => {
    const sourcePath = 'content/lectures/Lec10/vitepress.md'
    const published = multiCodeAt(sourcePath, 486)
    const changedPresentation = published
      .replace('"REST CRUD: /orders"', '"Другой заголовок"')
      .replace(/^(:{3,}\s+multi-code[^\n]*)$/m, '$1 {default=go playground=off}')

    const id = createAskAiBlockId('multi-code', published, 486, sourcePath)
    expect(id).toBe('kpo-ai-486-multi-code-10bb9h3')
    expect(createAskAiBlockId('multi-code', changedPresentation, 1500, sourcePath)).toBe(id)
    expect(createAskAiBlockId('multi-code', published, 486, `/workspace/KPO/${sourcePath}`)).toBe(
      id
    )
  })

  it('changes identity when a fence changes and keeps equal blocks distinct', () => {
    const sourcePath = 'content/lectures/Lec10/vitepress.md'
    const published = multiCodeAt(sourcePath, 486)
    const changedContent = published.replace(
      'fun Application.orderRoutes',
      'fun Application.changedRoutes'
    )

    expect(createAskAiBlockId('multi-code', changedContent, 486, sourcePath)).not.toBe(
      createAskAiBlockId('multi-code', published, 486, sourcePath)
    )

    const ids = createAskAiBlockIdAllocator('content/fixtures/example.md')
    const first = ids.next('multi-code', published, 1)
    const second = ids.next('multi-code', published, 2)
    expect(first).not.toBe(second)
  })

  it('keeps a published non-presentation block through a line move', () => {
    const sourcePath = 'content/lectures/Lec1/vitepress.md'
    const markdown = '# Лекция 1. Введение в КПО'
    const id = createAskAiBlockId('heading', markdown, 1, sourcePath)
    expect(id).toBe('kpo-ai-1-heading-14itr0x')
    expect(createAskAiBlockId('heading', markdown, 100, sourcePath)).toBe(id)
    expect(canonicalizeAskAiBlockIdentity('heading', markdown)).toBe(markdown)
  })

  it('canonicalizes fences but excludes container presentation metadata', () => {
    const sourcePath = 'content/lectures/Lec10/vitepress.md'
    const published = multiCodeAt(sourcePath, 486)
    const changedPresentation = published
      .replace('"REST CRUD: /orders"', '"Другая подпись"')
      .replace(/^(:{3,}\s+multi-code[^\n]*)$/m, '$1 {default=go playground=off}')

    expect(canonicalizeMultiCodeIdentity(changedPresentation)).toBe(
      canonicalizeMultiCodeIdentity(published)
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

function multiCodeBlocks(sourcePath: string): Array<{ markdown: string; lineStart: number }> {
  const lines = matter(readFileSync(sourcePath, 'utf8')).content.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Array<{ markdown: string; lineStart: number }> = []
  for (let index = 0; index < lines.length; index += 1) {
    const delimiter = lines[index].match(/^(:{3,})\s+multi-code\b/)?.[1]
    if (!delimiter) continue
    const start = index
    index += 1
    while (index < lines.length && lines[index].trim() !== delimiter) index += 1
    if (index >= lines.length) throw new Error(`Unclosed multi-code at ${sourcePath}:${start + 1}`)
    blocks.push({ markdown: lines.slice(start, index).join('\n').trim(), lineStart: start + 1 })
  }
  return blocks
}
