import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildAskAiPageContext, listAskAiContextEntries } from '../askAiContext'
import { getContentCatalog } from '../../shared/content/contentCatalog'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('askAiContext', () => {
  it('keeps service fixtures out of production Ask AI context generation', () => {
    const catalog = getContentCatalog({ fresh: true })
    const contextRouteKeys = listAskAiContextEntries().map((entry) => entry.routeKey)

    const servicePage = catalog.find((page) => page.routeKey === 'service-pages/ui-contract')
    expect(servicePage?.kind).toBe('service')
    expect(servicePage?.inclusion.askAi).toBe(false)
    expect(contextRouteKeys).not.toContain('service-pages/ui-contract')
  })

  it('extracts stable markdown blocks for code, mermaid, table and multi-code', () => {
    const context = buildAskAiPageContext(
      {
        routeKey: 'service-pages/ui-contract',
        sourcePath: 'content/service-pages/ui-contract/vitepress.md'
      },
      {
        courseTitle: 'Course',
        courseDescription: 'Description'
      }
    )

    expect(context.pageTitle).toBe('UI Contract Fixtures')
    expect(context.blocks.some((block) => block.kind === 'multi-code')).toBe(true)
    expect(context.blocks.some((block) => block.kind === 'mermaid')).toBe(true)
    expect(context.blocks.some((block) => block.kind === 'table')).toBe(true)
    expect(context.blocks.some((block) => block.kind === 'code')).toBe(true)

    const mermaid = context.blocks.find((block) => block.kind === 'mermaid')
    expect(mermaid?.markdown).toContain('```mermaid')
    expect(mermaid?.id).toMatch(/^kpo-ai-\d+-mermaid-/)

    const multiCode = context.blocks.find((block) => block.kind === 'multi-code')
    expect(multiCode?.markdown).toContain(':::: multi-code')
    expect(multiCode?.markdown).toContain('```kotlin')
  })

  it('replaces the absolute-path cache entry when source mtime changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'kpo-ask-ai-cache-'))
    temporaryRoots.push(root)
    const sourcePath = 'content/lectures/Lec1/vitepress.md'
    const absolutePath = join(root, sourcePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, '# First title\n\nFirst paragraph with enough context.', 'utf8')
    utimesSync(absolutePath, 1, 1)

    const entry = { routeKey: 'lectures/01', sourcePath }
    const options = { root, courseTitle: 'Course', courseDescription: 'Description' }
    expect(buildAskAiPageContext(entry, options).pageTitle).toBe('First title')

    writeFileSync(absolutePath, '# Updated title\n\nUpdated paragraph with enough context.', 'utf8')
    utimesSync(absolutePath, 2, 2)
    expect(buildAskAiPageContext(entry, options).pageTitle).toBe('Updated title')
  })

  it('keeps multi-code as one context block without duplicating inner fences', () => {
    const root = mkdtempSync(join(tmpdir(), 'kpo-ask-ai-multi-code-'))
    temporaryRoots.push(root)
    const sourcePath = 'content/lectures/Lec1/vitepress.md'
    const absolutePath = join(root, sourcePath)
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(
      absolutePath,
      '# Example\n\n::: multi-code\n```kotlin\nval x = 1\n```\n```java\nvar x = 1;\n```\n:::',
      'utf8'
    )

    const context = buildAskAiPageContext(
      { routeKey: 'lectures/01', sourcePath },
      { root, courseTitle: 'Course', courseDescription: 'Description' }
    )

    expect(context.blocks.filter((block) => block.kind === 'multi-code')).toHaveLength(1)
    expect(context.blocks.filter((block) => block.kind === 'code')).toHaveLength(0)
  })
})
