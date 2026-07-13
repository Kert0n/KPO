import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import { createAskAiBlockIdAllocator, type AskAiBlockKind } from '../shared/core/askAiIds'
import { findContentPageByOutputPath, getContentCatalog } from '../shared/content/contentCatalog'
import { classifyMarkdownToken, isMultiCodeOpen } from '../shared/core/markdownStructure'
import { escapeAttribute } from './htmlUtils'

export function askAiAnchorsPlugin(md: MarkdownIt): void {
  md.core.ruler.push('kpo_ask_ai_anchors', (state) => {
    if (!isAskAiEnabled(state.env)) return
    const lines = state.src.replace(/\r\n?/g, '\n').split('\n')
    const sourcePath = markdownSourcePath(state.env)
    const ids = createAskAiBlockIdAllocator(sourcePath)
    for (let index = 0; index < state.tokens.length; index += 1) {
      const token = state.tokens[index]
      if (token.level !== 0) continue

      const classification = classifyMarkdownToken(state.tokens, index)
      if (classification) assignBlockId(token, classification.kind, lines, ids)
    }
  })
}

function isAskAiEnabled(environment: unknown): boolean {
  if (!environment || typeof environment !== 'object') return true
  const frontmatter = (environment as { frontmatter?: Record<string, unknown> }).frontmatter
  if (frontmatter?.askAiFixture === true) return true
  if (frontmatter?.askAi === false) return false

  const sourcePath = markdownSourcePath(environment)
  const page = sourcePath
    ? getContentCatalog().find((candidate) => candidate.sourcePath === sourcePath)
    : undefined
  return page?.inclusion.askAi ?? true
}

export function askAiBlockId(token: Token): string {
  return typeof token.meta?.kpoAskAiBlockId === 'string' ? token.meta.kpoAskAiBlockId : ''
}

export function askAiBlockAttribute(token: Token): string {
  const id = askAiBlockId(token)
  return id ? ` data-kpo-ask-block-id="${escapeAttribute(id)}"` : ''
}

function assignBlockId(
  token: Token,
  kind: AskAiBlockKind,
  lines: string[],
  ids: ReturnType<typeof createAskAiBlockIdAllocator>
): void {
  if (!token.map) return
  const [start, end] = token.map
  const markdown = lines.slice(start, end).join('\n').trim()
  if (!markdown) return

  const id = ids.next(kind, markdown, start + 1, end)
  token.meta = { ...token.meta, kpoAskAiBlockId: id }
  if (
    token.nesting !== -1 &&
    token.type !== 'fence' &&
    kind !== 'image' &&
    kind !== 'table' &&
    (!token.type.startsWith('container_') || !isMultiCodeOpen(token))
  ) {
    token.attrSet('data-kpo-ask-block-id', id)
  }
}

function markdownSourcePath(environment: unknown): string | undefined {
  if (!environment || typeof environment !== 'object') return undefined
  const value = environment as { path?: unknown; relativePath?: unknown }
  const candidates = [value.path, value.relativePath].filter(
    (candidate): candidate is string => typeof candidate === 'string'
  )
  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, '/')
    const contentIndex = normalized.lastIndexOf('/content/')
    const relative =
      contentIndex >= 0 ? normalized.slice(contentIndex + '/content/'.length) : normalized
    const page = findContentPageByOutputPath(relative)
    if (page) return page.sourcePath
    if (contentIndex >= 0) return normalized.slice(contentIndex + 1)
  }
  return candidates[0]
}
