import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import container from 'markdown-it-container'
import matter from 'gray-matter'
import { contentPagesFor } from '../shared/content/contentCatalog'
import { createAskAiBlockIdAllocator, type AskAiBlockKind } from '../shared/core/askAiIds'
import type { AskAiBlock, AskAiPageContext } from '../shared/core/askAiModel'
import { classifyMarkdownToken, findMatchingMultiCodeClose } from '../shared/core/markdownStructure'

export type AskAiContextEntry = {
  routeKey: string
  sourcePath: string
}

type AskAiContextOptions = {
  root?: string
  courseTitle: string
  courseDescription: string
}

type CacheEntry = {
  mtimeMs: number
  context: AskAiPageContext
}

const cache = new Map<string, CacheEntry>()
const markdown = MarkdownIt({ html: true }).use(container, 'multi-code')
export function listAskAiContextEntries(root = process.cwd()): AskAiContextEntry[] {
  return contentPagesFor('askAi', { root, fresh: true })
    .sort(
      (left, right) =>
        askAiPageRank(left.kind) - askAiPageRank(right.kind) ||
        left.sourcePath.localeCompare(right.sourcePath, 'en')
    )
    .map((page) => ({
      routeKey: page.routeKey,
      sourcePath: page.sourcePath
    }))
}

function askAiPageRank(kind: ReturnType<typeof contentPagesFor>[number]['kind']): number {
  return {
    home: 0,
    intro: 1,
    conclusion: 2,
    lecture: 3,
    'extras-index': 4,
    extra: 5,
    service: 6
  }[kind]
}

export function buildAskAiPageContext(
  entry: AskAiContextEntry,
  options: AskAiContextOptions
): AskAiPageContext {
  const root = options.root ?? process.cwd()
  const absolutePath = resolve(root, entry.sourcePath)
  const stat = statSync(absolutePath)
  const cached = cache.get(absolutePath)
  if (cached?.mtimeMs === stat.mtimeMs) return cached.context

  const source = readFileSync(absolutePath, 'utf8')
  const parsed = matter(source)
  const content = parsed.content.replace(/\r\n?/g, '\n')
  const lines = content.split('\n')
  const tokens = markdown.parse(content, {})

  const context: AskAiPageContext = {
    courseTitle: options.courseTitle,
    courseDescription: options.courseDescription,
    pageTitle: pageTitle(parsed.data, content),
    pageDescription: pageDescription(parsed.data, content),
    sourcePath: entry.sourcePath,
    blocks: collectBlocks(tokens, lines, entry.sourcePath)
  }

  cache.set(absolutePath, { mtimeMs: stat.mtimeMs, context })
  return context
}

export function writeAskAiContexts(outDir: string, options: AskAiContextOptions): void {
  for (const entry of listAskAiContextEntries(options.root)) {
    const context = buildAskAiPageContext(entry, options)
    const file = join(outDir, '__ask-ai-context', `${entry.routeKey}.json`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(context), 'utf8')
  }
}

export function findAskAiContextEntry(
  routeKey: string,
  root = process.cwd()
): AskAiContextEntry | null {
  return listAskAiContextEntries(root).find((entry) => entry.routeKey === routeKey) ?? null
}

function collectBlocks(tokens: Token[], lines: string[], sourcePath: string): AskAiBlock[] {
  const blocks: AskAiBlock[] = []
  const ids = createAskAiBlockIdAllocator(sourcePath)
  let skipUntil = -1

  for (let index = 0; index < tokens.length; index += 1) {
    if (index < skipUntil) continue

    const token = tokens[index]
    if (token.level !== 0 && token.type !== 'fence') continue

    const classification = classifyMarkdownToken(tokens, index)
    if (!classification) continue

    if (classification.kind === 'multi-code') {
      const closeIndex = findMatchingMultiCodeClose(tokens, index)
      const block = createBlock('multi-code', token, lines, sourcePath, ids)
      if (block) blocks.push(block)
      skipUntil = closeIndex === -1 ? index + 1 : closeIndex + 1
      continue
    }

    if (classification.kind === 'code' || classification.kind === 'mermaid') {
      const block = createBlock(classification.kind, token, lines, sourcePath, ids, {
        language: classification.language
      })
      if (block) blocks.push(block)
      continue
    }

    const block = createBlock(classification.kind, token, lines, sourcePath, ids)
    if (block) blocks.push(block)
  }

  return blocks
}

function createBlock(
  kind: AskAiBlockKind,
  token: Token,
  lines: string[],
  sourcePath: string,
  ids: ReturnType<typeof createAskAiBlockIdAllocator>,
  extra: Partial<Pick<AskAiBlock, 'language' | 'title'>> = {}
): AskAiBlock | null {
  if (!token.map) return null

  const [start, end] = token.map
  const markdownText = lines.slice(start, end).join('\n').trim()
  if (!markdownText) return null

  return {
    id: ids.next(kind, markdownText, start + 1),
    kind,
    markdown: markdownText,
    plainText: plainText(markdownText),
    lineStart: start + 1,
    lineEnd: end,
    ...extra
  }
}

function pageTitle(data: Record<string, unknown>, content: string): string {
  if (typeof data.title === 'string' && data.title.trim() !== '') return data.title.trim()
  return content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? 'Материал курса'
}

function pageDescription(data: Record<string, unknown>, content: string): string {
  if (typeof data.description === 'string' && data.description.trim() !== '') {
    return data.description.trim()
  }

  const paragraph = content
    .replace(/^#\s+.+?$/m, '')
    .split(/\n{2,}/)
    .map((part) => plainText(part))
    .find((part) => part.length > 20)

  return paragraph ?? ''
}

function plainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/^```.*\n?/, '').replace(/\n?```$/, ''))
    .replace(/!\[[^\]]*]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`|~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
