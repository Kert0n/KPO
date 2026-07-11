import type Token from 'markdown-it/lib/token.mjs'

export type MarkdownBlockKind =
  | 'code'
  | 'multi-code'
  | 'mermaid'
  | 'heading'
  | 'paragraph'
  | 'image'
  | 'list'
  | 'blockquote'
  | 'table'

export type MarkdownBlockClassification = {
  kind: MarkdownBlockKind
  language?: string
}

export function classifyMarkdownToken(
  tokens: readonly Token[],
  index: number
): MarkdownBlockClassification | null {
  const token = tokens[index]
  if (!token) return null

  if (isMultiCodeOpen(token)) return { kind: 'multi-code' }
  if (token.type === 'fence') {
    const language = fenceLanguage(token)
    return { kind: language === 'mermaid' ? 'mermaid' : 'code', language }
  }
  if (token.type === 'heading_open') return { kind: 'heading' }
  if (token.type === 'paragraph_open') {
    return { kind: isImageOnlyParagraph(tokens, index) ? 'image' : 'paragraph' }
  }
  if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
    return { kind: 'list' }
  }
  if (token.type === 'blockquote_open') return { kind: 'blockquote' }
  if (token.type === 'table_open') return { kind: 'table' }
  return null
}

export function fenceLanguage(token: Pick<Token, 'info'>): string {
  return token.info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
}

export function isMultiCodeOpen(token: Pick<Token, 'type'>): boolean {
  return token.type === 'container_multi-code_open'
}

export function isMultiCodeClose(token: Pick<Token, 'type'>): boolean {
  return token.type === 'container_multi-code_close'
}

export function findMatchingMultiCodeClose(tokens: readonly Token[], openIndex: number): number {
  const open = tokens[openIndex]
  if (!open || !isMultiCodeOpen(open)) return -1

  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (isMultiCodeClose(token) && token.level === open.level) return index
  }
  return -1
}

export function isImageOnlyParagraph(tokens: readonly Token[], paragraphIndex: number): boolean {
  const inline = tokens[paragraphIndex + 1]
  if (!inline || inline.type !== 'inline' || !inline.children) return false

  const meaningfulChildren = inline.children.filter((child) => {
    return child.type !== 'text' || child.content.trim() !== ''
  })
  return meaningfulChildren.length === 1 && meaningfulChildren[0].type === 'image'
}
