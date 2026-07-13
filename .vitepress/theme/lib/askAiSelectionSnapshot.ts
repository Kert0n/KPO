import { readPlaygroundCode } from './playgroundRegistry'

export function playgroundOverride(
  blockId: string
): { kind: 'playground'; language: 'kotlin'; markdown: string } | undefined {
  if (!blockId) return undefined
  const code = readPlaygroundCode(blockId)
  if (!code) return undefined
  return {
    kind: 'playground',
    language: 'kotlin',
    markdown: `\`\`\`kotlin\n${code.replace(/\n?$/, '\n')}\`\`\``
  }
}
