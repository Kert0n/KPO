import { stableHash } from './hash'

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

export { stableHash }

export function createAskAiBlockId(kind: AskAiBlockKind, markdown: string, lineStart: number): string {
  return `kpo-ai-${lineStart}-${kind}-${stableHash(markdown)}`
}
