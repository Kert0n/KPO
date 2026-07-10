import type Token from 'markdown-it/lib/token.mjs'

export type MarkdownStructureKind =
  'code' | 'multi-code' | 'mermaid' | 'heading' | 'paragraph' | 'image' | 'list' | 'blockquote' | 'table'

export type MarkdownStructureBlock = {
  kind: MarkdownStructureKind
  tokenIndex: number
  lineStart: number
  lineEnd: number
  language?: string
}

export function classifyMarkdownTokens(tokens: Token[]): MarkdownStructureBlock[] {
  const blocks: MarkdownStructureBlock[] = []
  let multiCodeDepth = 0

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex]

    if (token.type === 'container_multi-code_open') {
      multiCodeDepth += 1
      appendBlock(blocks, token, tokenIndex, 'multi-code')
      continue
    }
    if (token.type === 'container_multi-code_close') {
      multiCodeDepth = Math.max(0, multiCodeDepth - 1)
      continue
    }
    if (multiCodeDepth > 0) continue
    if (token.level !== 0 && token.type !== 'fence') continue

    if (token.type === 'fence') {
      const language = token.info.trim().split(/\s+/)[0] ?? ''
      appendBlock(blocks, token, tokenIndex, language === 'mermaid' ? 'mermaid' : 'code', language)
    } else if (token.type === 'heading_open') {
      appendBlock(blocks, token, tokenIndex, 'heading')
    } else if (token.type === 'paragraph_open') {
      appendBlock(blocks, token, tokenIndex, isImageOnlyParagraph(tokens, tokenIndex) ? 'image' : 'paragraph')
    } else if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      appendBlock(blocks, token, tokenIndex, 'list')
    } else if (token.type === 'blockquote_open') {
      appendBlock(blocks, token, tokenIndex, 'blockquote')
    } else if (token.type === 'table_open') {
      appendBlock(blocks, token, tokenIndex, 'table')
    }
  }

  return blocks
}

export function isImageOnlyParagraph(tokens: Token[], openIndex: number): boolean {
  const inline = tokens[openIndex + 1]
  if (inline?.type !== 'inline') return false

  const meaningfulChildren = (inline.children ?? []).filter(
    (child) => child.type !== 'text' || child.content.trim() !== ''
  )
  return meaningfulChildren.length === 1 && meaningfulChildren[0].type === 'image'
}

function appendBlock(
  blocks: MarkdownStructureBlock[],
  token: Token,
  tokenIndex: number,
  kind: MarkdownStructureKind,
  language?: string
): void {
  if (!token.map) return
  const [start, end] = token.map
  blocks.push({
    kind,
    tokenIndex,
    lineStart: start + 1,
    lineEnd: end,
    ...(language !== undefined ? { language } : {})
  })
}
