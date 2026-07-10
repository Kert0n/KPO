import { describe, expect, it } from 'vitest'
import { buildAskAiPageContext } from '../askAiContext'

describe('askAiContext', () => {
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
})
