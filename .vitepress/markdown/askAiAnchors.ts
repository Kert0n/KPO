import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { createAskAiBlockId } from '../lib/askAiIds'
import { classifyMarkdownTokens, type MarkdownStructureKind } from '../shared/core/markdownStructure'
import { escapeAttribute } from './htmlUtils'

export function askAiAnchorsPlugin(md: MarkdownIt): void {
  md.core.ruler.push('kpo_ask_ai_anchors', (state) => {
    const lines = state.src.replace(/\r\n?/g, '\n').split('\n')
    for (const block of classifyMarkdownTokens(state.tokens)) {
      assignBlockId(state.tokens[block.tokenIndex], block.kind, lines)
    }
  })
}

export function askAiBlockId(token: Token): string {
  return typeof token.meta?.kpoAskAiBlockId === 'string' ? token.meta.kpoAskAiBlockId : ''
}

export function askAiBlockAttribute(token: Token): string {
  const id = askAiBlockId(token)
  return id ? ` data-kpo-ask-block-id="${escapeAttribute(id)}"` : ''
}

function assignBlockId(token: Token, kind: MarkdownStructureKind, lines: string[]): void {
  if (!token.map) return
  const [start, end] = token.map
  const markdown = lines.slice(start, end).join('\n').trim()
  if (!markdown) return

  const id = createAskAiBlockId(kind, markdown, start + 1)
  token.meta = { ...token.meta, kpoAskAiBlockId: id }
  if (token.nesting !== -1 && token.type !== 'fence' && !token.type.startsWith('container_')) {
    token.attrSet('data-kpo-ask-block-id', id)
  }
}
