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
  | 'custom-container'

import { stableHash } from './hash'
import { normalizeLanguage } from './codeLanguage'

export { stableHash }

export function createAskAiBlockId(
  kind: AskAiBlockKind,
  markdown: string,
  lineStart: number,
  sourcePath?: string,
  lineEnd = lineStart
): string {
  const canonical = canonicalizeAskAiBlockIdentity(kind, markdown)
  return `kpo-ai-${lineStart}-${kind}-${stableHash(
    `${normalizeSourceIdentity(sourcePath)}\n${kind}\n${lineStart}:${lineEnd}\n${canonical}`
  )}`
}

export function createAskAiBlockIdAllocator(sourcePath?: string): {
  next(kind: AskAiBlockKind, markdown: string, lineStart: number, lineEnd?: number): string
} {
  return {
    next(kind, markdown, lineStart, lineEnd = lineStart) {
      return createAskAiBlockId(kind, markdown, lineStart, sourcePath, lineEnd)
    }
  }
}

export function canonicalizeAskAiBlockIdentity(kind: AskAiBlockKind, markdown: string): string {
  return kind === 'multi-code'
    ? canonicalizeMultiCodeIdentity(markdown)
    : normalizeMarkdown(markdown)
}

export function canonicalizeMultiCodeIdentity(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const first = lines.findIndex((line) => /^\s*:{3,}\s+multi-code\b/.test(line))
  if (first === -1) return normalizeMarkdown(markdown)

  const delimiter = lines[first].match(/^\s*(:{3,})/)?.[1] ?? ''
  const last = delimiter
    ? lines.findLastIndex((line, index) => index > first && line.trim() === delimiter)
    : -1
  const body = lines.slice(first + 1, last === -1 ? lines.length : last)
  const elements: string[] = []

  for (let index = 0; index < body.length; index += 1) {
    const fence = body[index].match(/^\s*(`{3,})\s*([^\s`]+).*$/)
    if (!fence) {
      const text = normalizeMarkdown(body[index])
      if (text) elements.push(`text:${text}`)
      continue
    }

    const delimiter = fence[1]
    const language = normalizeLanguage(fence[2]) || fence[2].toLowerCase()
    const code: string[] = []
    index += 1
    while (index < body.length && body[index].trim() !== delimiter) {
      code.push(body[index])
      index += 1
    }
    elements.push(`fence:${language}\n${normalizeMarkdown(code.join('\n'))}`)
  }

  return elements.join('\n\u001e\n')
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}

function normalizeSourceIdentity(sourcePath?: string): string {
  if (!sourcePath) return ''
  const normalized = sourcePath.replace(/\\/g, '/')
  const contentIndex = normalized.lastIndexOf('/content/')
  if (contentIndex >= 0) return normalized.slice(contentIndex + 1)
  if (normalized.startsWith('content/')) return normalized
  return `content/${normalized.replace(/^\//, '')}`
}
