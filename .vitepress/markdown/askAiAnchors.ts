import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { createAskAiBlockId, type AskAiBlockKind } from '../lib/askAiIds'

export function askAiAnchorsPlugin(md: MarkdownIt): void {
  md.core.ruler.push('kpo_ask_ai_anchors', (state) => {
    const lines = state.src.replace(/\r\n?/g, '\n').split('\n')
    let multiCodeDepth = 0

    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index]

      if (token.type === 'container_multi-code_open') {
        multiCodeDepth += 1
        assignBlockId(token, 'multi-code', lines)
        continue
      }

      if (token.type === 'container_multi-code_close') {
        multiCodeDepth = Math.max(0, multiCodeDepth - 1)
        continue
      }

      if (multiCodeDepth > 0 && token.type === 'fence') continue

      if (token.type === 'fence') {
        const language = token.info.trim().split(/\s+/)[0] ?? ''
        assignBlockId(token, language === 'mermaid' ? 'mermaid' : 'code', lines)
      } else if (token.type === 'heading_open') {
        assignBlockId(token, 'heading', lines)
      } else if (token.type === 'paragraph_open') {
        assignBlockId(token, isImageOnlyParagraph(state.tokens, index) ? 'image' : 'paragraph', lines)
      } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
        assignBlockId(token, 'list', lines)
      } else if (token.type === 'blockquote_open') {
        assignBlockId(token, 'blockquote', lines)
      } else if (token.type === 'table_open') {
        assignBlockId(token, 'table', lines)
      }
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

function assignBlockId(token: Token, kind: AskAiBlockKind, lines: string[]): void {
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

function isImageOnlyParagraph(tokens: Token[], openIndex: number): boolean {
  const inline = tokens[openIndex + 1]
  if (inline?.type !== 'inline') return false

  const meaningfulChildren = (inline.children ?? []).filter((child) => {
    return child.type !== 'text' || child.content.trim() !== ''
  })

  return meaningfulChildren.length === 1 && meaningfulChildren[0].type === 'image'
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
