import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import container from 'markdown-it-container'
import matter from 'gray-matter'
import { isImageOnlyParagraph } from '../markdown/tokenUtils'
import { createAskAiBlockId, type AskAiBlockKind } from './askAiIds'
import { extractNumber } from './content'
import type { AskAiBlock, AskAiPageContext } from '../theme/lib/askAiModel'

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
  const entries: AskAiContextEntry[] = []

  addIfExists(entries, root, 'index', 'index.md')
  addIfExists(entries, root, 'intro', 'intro.md')
  addIfExists(entries, root, 'conclusion', 'conclusion.md')
  scanNumberedPages(entries, root, 'lectures')
  addIfExists(entries, root, 'extras/index', 'extras/index.md')
  scanNumberedPages(entries, root, 'extras')

  const seen = new Set<string>()
  return entries.filter((entry) => {
    if (seen.has(entry.routeKey)) return false
    seen.add(entry.routeKey)
    return true
  })
}

export function buildAskAiPageContext(
  entry: AskAiContextEntry,
  options: AskAiContextOptions
): AskAiPageContext {
  const root = options.root ?? process.cwd()
  const absolutePath = resolve(root, entry.sourcePath)
  const stat = statSync(absolutePath)
  const cacheKey = `${absolutePath}:${stat.mtimeMs}`
  const cached = cache.get(cacheKey)
  if (cached) return cached.context

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
    blocks: collectBlocks(tokens, lines)
  }

  cache.set(cacheKey, { mtimeMs: stat.mtimeMs, context })
  return context
}

export function writeAskAiContexts(
  outDir: string,
  options: AskAiContextOptions
): void {
  for (const entry of listAskAiContextEntries(options.root)) {
    const context = buildAskAiPageContext(entry, options)
    const file = join(outDir, '__ask-ai-context', `${entry.routeKey}.json`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(context), 'utf8')
  }
}

export function findAskAiContextEntry(routeKey: string, root = process.cwd()): AskAiContextEntry | null {
  return listAskAiContextEntries(root).find((entry) => entry.routeKey === routeKey) ?? null
}

function collectBlocks(tokens: Token[], lines: string[]): AskAiBlock[] {
  const blocks: AskAiBlock[] = []
  let skipUntil = -1

  for (let index = 0; index < tokens.length; index += 1) {
    if (index < skipUntil) continue

    const token = tokens[index]
    if (token.level !== 0 && token.type !== 'fence') continue

    if (token.type === 'container_multi-code_open') {
      const closeIndex = findMatchingClose(tokens, index)
      const block = createBlock('multi-code', token, lines)
      if (block) blocks.push(block)
      skipUntil = closeIndex === -1 ? index + 1 : closeIndex + 1
      continue
    }

    if (token.type === 'fence') {
      const info = token.info.trim().split(/\s+/)[0] ?? ''
      const kind: AskAiBlockKind = info === 'mermaid' ? 'mermaid' : 'code'
      const block = createBlock(kind, token, lines, { language: info })
      if (block) blocks.push(block)
      continue
    }

    if (token.type === 'heading_open') {
      const block = createBlock('heading', token, lines)
      if (block) blocks.push(block)
      continue
    }

    if (token.type === 'paragraph_open') {
      const kind: AskAiBlockKind = isImageOnlyParagraph(tokens, index) ? 'image' : 'paragraph'
      const block = createBlock(kind, token, lines)
      if (block) blocks.push(block)
      continue
    }

    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') {
      const block = createBlock('list', token, lines)
      if (block) blocks.push(block)
      continue
    }

    if (token.type === 'blockquote_open') {
      const block = createBlock('blockquote', token, lines)
      if (block) blocks.push(block)
      continue
    }

    if (token.type === 'table_open') {
      const block = createBlock('table', token, lines)
      if (block) blocks.push(block)
    }
  }

  return blocks
}

function createBlock(
  kind: AskAiBlockKind,
  token: Token,
  lines: string[],
  extra: Partial<Pick<AskAiBlock, 'language' | 'title'>> = {}
): AskAiBlock | null {
  if (!token.map) return null

  const [start, end] = token.map
  const markdownText = lines.slice(start, end).join('\n').trim()
  if (!markdownText) return null

  return {
    id: createAskAiBlockId(kind, markdownText, start + 1),
    kind,
    markdown: markdownText,
    plainText: plainText(markdownText),
    lineStart: start + 1,
    lineEnd: end,
    ...extra
  }
}

function addIfExists(entries: AskAiContextEntry[], root: string, routeKey: string, sourcePath: string): void {
  if (existsSync(resolve(root, sourcePath))) {
    entries.push({ routeKey, sourcePath })
  }
}

function scanNumberedPages(entries: AskAiContextEntry[], root: string, directory: 'lectures' | 'extras'): void {
  const directoryPath = resolve(root, directory)
  if (!existsSync(directoryPath)) return

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue

    if (entry.isFile()) {
      if (!entry.name.endsWith('.md') || entry.name === 'index.md') continue
      entries.push({
        routeKey: `${directory}/${entry.name.replace(/\.md$/, '')}`,
        sourcePath: `${directory}/${entry.name}`
      })
      continue
    }

    if (entry.isDirectory()) {
      const sourcePath = `${directory}/${entry.name}/vitepress.md`
      if (!existsSync(resolve(root, sourcePath))) continue
      const order = extractNumber(entry.name)
      const slug = Number.isFinite(order) ? String(order).padStart(2, '0') : entry.name
      entries.push({
        routeKey: `${directory}/${slug}`,
        sourcePath
      })
    }
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

function findMatchingClose(tokens: Token[], openIndex: number): number {
  const open = tokens[openIndex]
  for (let index = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type === 'container_multi-code_close' && token.level === open.level) return index
  }
  return -1
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
