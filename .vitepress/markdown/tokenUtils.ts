import type Token from 'markdown-it/lib/token.mjs'

export function isImageOnlyParagraph(tokens: Token[], openIndex: number): boolean {
  const inline = tokens[openIndex + 1]
  if (inline?.type !== 'inline') return false

  const meaningfulChildren = (inline.children ?? []).filter((child) => {
    return child.type !== 'text' || child.content.trim() !== ''
  })

  return meaningfulChildren.length === 1 && meaningfulChildren[0].type === 'image'
}
