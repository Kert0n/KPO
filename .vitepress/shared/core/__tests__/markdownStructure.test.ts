import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import { describe, expect, it } from 'vitest'
import { classifyMarkdownToken, findMatchingMultiCodeClose } from '../markdownStructure'

describe('markdown structure classifier', () => {
  it('classifies every public block kind from MarkdownIt tokens', () => {
    const md = MarkdownIt().use(container, 'multi-code')
    const tokens = md.parse(
      [
        '# Heading',
        '',
        'Paragraph',
        '',
        '![Image](image.svg)',
        '',
        '- item',
        '',
        '> quote',
        '',
        '| A |',
        '| - |',
        '| B |',
        '',
        '```kotlin',
        'val value = 1',
        '```',
        '',
        '```mermaid',
        'flowchart LR',
        '```',
        '',
        '::: multi-code',
        '```java',
        'class Example {}',
        '```',
        ':::'
      ].join('\n'),
      {}
    )

    expect(
      tokens.map((_, index) => classifyMarkdownToken(tokens, index)?.kind).filter(Boolean)
    ).toEqual(
      expect.arrayContaining([
        'heading',
        'paragraph',
        'image',
        'list',
        'blockquote',
        'table',
        'code',
        'mermaid',
        'multi-code'
      ])
    )
  })

  it('finds the matching multi-code close token', () => {
    const md = MarkdownIt().use(container, 'multi-code')
    const tokens = md.parse('::: multi-code\n```kotlin\nval x = 1\n```\n:::', {})
    const openIndex = tokens.findIndex((token) => token.type === 'container_multi-code_open')
    expect(findMatchingMultiCodeClose(tokens, openIndex)).toBeGreaterThan(openIndex)
  })
})
