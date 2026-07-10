import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import container from 'markdown-it-container'
import matter from 'gray-matter'
import { createAskAiBlockId } from './askAiIds'
import { getContentCatalog } from '../shared/content/contentCatalog'
import type { AskAiBlock, AskAiPageContext } from '../shared/core/askAiModel'
import { classifyMarkdownTokens, type MarkdownStructureBlock } from '../shared/core/markdownStructure'

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
  return getContentCatalog(root)
    .pages.filter((page) => page.inclusion.askAi)
    .map((page) => ({ routeKey: page.routeKey, sourcePath: page.sourcePath }))
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
    blocks: collectBlocks(tokens, lines)
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

export function findAskAiContextEntry(routeKey: string, root = process.cwd()): AskAiContextEntry | null {
  return listAskAiContextEntries(root).find((entry) => entry.routeKey === routeKey) ?? null
}

function collectBlocks(tokens: Token[], lines: string[]): AskAiBlock[] {
  return classifyMarkdownTokens(tokens)
    .map((structure) => createBlock(structure, lines))
    .filter((block): block is AskAiBlock => block !== null)
}

function createBlock(structure: MarkdownStructureBlock, lines: string[]): AskAiBlock | null {
  const markdownText = lines
    .slice(structure.lineStart - 1, structure.lineEnd)
    .join('\n')
    .trim()
  if (!markdownText) return null

  return {
    id: createAskAiBlockId(structure.kind, markdownText, structure.lineStart),
    kind: structure.kind,
    markdown: markdownText,
    plainText: plainText(markdownText),
    lineStart: structure.lineStart,
    lineEnd: structure.lineEnd,
    ...(structure.language !== undefined ? { language: structure.language } : {})
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
