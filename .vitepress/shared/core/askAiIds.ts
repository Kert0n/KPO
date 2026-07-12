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

import { stableHash } from './hash'
import { legacyMultiCodeBlockId } from './askAiLegacyIds'

export { stableHash }

export function createAskAiBlockId(
  kind: AskAiBlockKind,
  markdown: string,
  lineStart: number,
  sourcePath?: string
): string {
  if (kind === 'multi-code') {
    const legacyId = legacyMultiCodeBlockId(sourcePath, lineStart, markdown)
    if (legacyId) return legacyId
  }
  return `kpo-ai-${lineStart}-${kind}-${stableHash(markdown)}`
}
