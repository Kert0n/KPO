export type AskAiBlockKind =
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'blockquote'
  | 'code'
  | 'multi-code'
  | 'playground'
  | 'mermaid'
  | 'table'
  | 'image'

export function createAskAiBlockId(
  kind: AskAiBlockKind,
  markdown: string,
  lineStart: number
): string {
  return `kpo-ai-${lineStart}-${kind}-${stableHash(markdown)}`
}

export function stableHash(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}
