import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import container from 'markdown-it-container'
import matter from 'gray-matter'
import { contentPagesFor, getContentCatalog } from '../shared/content/contentCatalog'
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
const markdown = createContextMarkdownParser()
export function listAskAiContextEntries(root = process.cwd()): AskAiContextEntry[] {
  return [
    ...contentPagesFor('askAi', { root, fresh: true }),
    ...getContentCatalog({ root }).filter(
      (page) => page.kind === 'service' && isAskAiFixture(page.sourcePath, root)
    )
  ]
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

export function assertAskAiContextParity(outDir: string, options: AskAiContextOptions): void {
  const root = options.root ?? process.cwd()
  const entries = new Map(listAskAiContextEntries(root).map((entry) => [entry.sourcePath, entry]))
  for (const page of getContentCatalog({ root, fresh: true })) {
    const entry = entries.get(page.sourcePath)
    const htmlFile = join(outDir, page.outputPath.replace(/\.md$/, '.html'))
    const html = readFileSync(htmlFile, 'utf8')
    const domIds = [...html.matchAll(/data-kpo-ask-block-id="([^"]+)"/g)].map((match) => match[1])
    const contextIds = entry
      ? buildAskAiPageContext(entry, options).blocks.map((block) => block.id)
      : []
    assertMatchingIds(page.sourcePath, domIds, contextIds)
  }
}

function assertMatchingIds(sourcePath: string, domIds: string[], contextIds: string[]): void {
  const uniqueDom = new Set(domIds)
  const uniqueContext = new Set(contextIds)
  const duplicateDom = domIds.filter((id, index) => domIds.indexOf(id) !== index)
  const duplicateContext = contextIds.filter((id, index) => contextIds.indexOf(id) !== index)
  const missing = [...uniqueDom].filter((id) => !uniqueContext.has(id))
  const extra = [...uniqueContext].filter((id) => !uniqueDom.has(id))
  if (
    duplicateDom.length === 0 &&
    duplicateContext.length === 0 &&
    missing.length === 0 &&
    extra.length === 0
  )
    return
  const show = (ids: string[]) => (ids.length ? [...new Set(ids)].join(', ') : '(none)')
  throw new Error(
    [
      `[ask-ai] DOM/context identity mismatch for ${sourcePath}`,
      `duplicate DOM IDs: ${show(duplicateDom)}`,
      `duplicate context IDs: ${show(duplicateContext)}`,
      `missing from context: ${show(missing)}`,
      `missing from DOM: ${show(extra)}`
    ].join('\n')
  )
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
    if (token.level !== 0) continue

    const classification = classifyMarkdownToken(tokens, index)
    if (!classification) continue

    if (classification.kind === 'multi-code') {
      const closeIndex = findMatchingMultiCodeClose(tokens, index)
      const block = createBlock('multi-code', token, lines, sourcePath, ids)
      if (block) blocks.push(block)
      skipUntil = closeIndex === -1 ? index + 1 : closeIndex + 1
      continue
    }

    if (classification.kind === 'custom-container') {
      const block = createBlock('custom-container', token, lines, sourcePath, ids, {
        title: containerTitle(token)
      })
      if (block) blocks.push(block)
      const closeIndex = findMatchingContainerClose(tokens, index)
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
    id: ids.next(kind, markdownText, start + 1, end),
    kind,
    markdown: markdownText,
    plainText: plainText(markdownText),
    lineStart: start + 1,
    lineEnd: end,
    ...extra
  }
}

function createContextMarkdownParser(): MarkdownIt {
  const parser = MarkdownIt({ html: true })
  parser.block.ruler.disable('code')
  for (const name of [
    'tip',
    'info',
    'warning',
    'danger',
    'details',
    'v-pre',
    'raw',
    'only',
    'multi-code'
  ]) {
    parser.use(container, name)
  }
  return parser
}

function findMatchingContainerClose(tokens: Token[], openIndex: number): number {
  const open = tokens[openIndex]
  const closeType = open.type.replace(/_open$/, '_close')
  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    if (tokens[index].type === closeType && tokens[index].level === open.level) return index
  }
  return -1
}

function containerTitle(token: Token): string | undefined {
  const value = token.info.replace(/^\S+/, '').trim().replace(/^"|"$/g, '')
  return value || undefined
}

function isAskAiFixture(sourcePath: string, root: string): boolean {
  const absolutePath = resolve(root, sourcePath)
  if (!statSync(absolutePath).isFile()) return false
  return matter(readFileSync(absolutePath, 'utf8')).data.askAiFixture === true
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
