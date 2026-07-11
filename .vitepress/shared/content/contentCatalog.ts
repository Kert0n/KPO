import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import matter from 'gray-matter'
import { inclusionForKind } from './contentPolicy.ts'
import type { ContentPage, ContentPageKind, ContentSection } from './contentTypes.ts'

const staticPages: Array<{
  kind: ContentPageKind
  section: ContentSection
  sourcePath: string
  outputPath: string
  route: string
  routeKey: string
  order: number
  fallbackTitle: string
  navigationTitle?: string
}> = [
  {
    kind: 'home',
    section: 'root',
    sourcePath: 'content/home/vitepress.md',
    outputPath: 'index.md',
    route: '/',
    routeKey: 'index',
    order: 0,
    fallbackTitle: 'Конструирование ПО'
  },
  {
    kind: 'intro',
    section: 'root',
    sourcePath: 'content/intro/vitepress.md',
    outputPath: 'intro.md',
    route: '/intro',
    routeKey: 'intro',
    order: 1,
    fallbackTitle: 'Введение'
  },
  {
    kind: 'extras-index',
    section: 'extras',
    sourcePath: 'content/extras/index/vitepress.md',
    outputPath: 'extras/index.md',
    route: '/extras/',
    routeKey: 'extras/index',
    order: 0,
    fallbackTitle: 'О дополнениях',
    navigationTitle: 'О дополнениях'
  },
  {
    kind: 'conclusion',
    section: 'root',
    sourcePath: 'content/conclusion/vitepress.md',
    outputPath: 'conclusion.md',
    route: '/conclusion',
    routeKey: 'conclusion',
    order: 1000,
    fallbackTitle: 'Заключение'
  },
  {
    kind: 'service',
    section: 'service',
    sourcePath: 'content/service-pages/ui-contract/vitepress.md',
    outputPath: 'service-pages/ui-contract.md',
    route: '/service-pages/ui-contract',
    routeKey: 'service-pages/ui-contract',
    order: 0,
    fallbackTitle: 'UI Contract Fixtures'
  }
]

const catalogCache = new Map<string, ContentPage[]>()

export function getContentCatalog(options: { fresh?: boolean; root?: string } = {}): ContentPage[] {
  const catalogRoot = resolve(options.root ?? process.cwd())
  const cached = catalogCache.get(catalogRoot)
  if (cached && !options.fresh) return cached

  const pages = [
    ...staticPages
      .map((page) => toStaticPage(page, catalogRoot))
      .filter((page): page is ContentPage => page !== null),
    ...scanNumberedSection(catalogRoot, 'lectures', 'lecture', 'Лекция'),
    ...scanNumberedSection(catalogRoot, 'extras', 'extra', 'Дополнение')
  ]

  validateContentCatalog(pages)
  const catalog = pages.sort(comparePages)
  catalogCache.set(catalogRoot, catalog)
  return catalog
}

export function contentPagesFor(
  channel: keyof ContentPage['inclusion'],
  options: { fresh?: boolean; root?: string } = {}
): ContentPage[] {
  return getContentCatalog(options).filter((page) => page.inclusion[channel])
}

export function findContentPageByOutputPath(outputPath: string): ContentPage | undefined {
  const normalized = outputPath.replace(/\\/g, '/').replace(/^\//, '')
  return getContentCatalog().find((page) => {
    return (
      page.outputPath === normalized || page.sourcePath.replace(/^content\//, '') === normalized
    )
  })
}

export function getCatalogRewrites(): Record<string, string> {
  return Object.fromEntries(
    getContentCatalog().map((page) => [page.sourcePath.replace(/^content\//, ''), page.outputPath])
  )
}

export function validateContentCatalog(pages = getContentCatalog()): void {
  assertUnique(pages, (page) => page.route, 'route')
  assertUnique(pages, (page) => page.outputPath, 'output path')
  assertUnique(pages, (page) => page.sourcePath, 'source path')

  for (const section of ['lectures', 'extras'] as const) {
    const numbered = pages.filter(
      (page) => page.section === section && page.kind !== 'extras-index'
    )
    assertUnique(numbered, (page) => String(page.order), `${section} order`)
  }

  for (const page of pages) {
    if (/(?:^|\/)(?:_template|_internal)(?:\/|$)/.test(page.sourcePath)) {
      throw new Error(`Internal content must not be published: ${page.sourcePath}`)
    }
    if (
      page.kind === 'service' &&
      Object.entries(page.inclusion).some(([channel, included]) => {
        return channel !== 'uiSweep' && included
      })
    ) {
      throw new Error(`Service page leaked into a public channel: ${page.route}`)
    }
  }
}

function toStaticPage(
  definition: (typeof staticPages)[number],
  catalogRoot: string
): ContentPage | null {
  const absolutePath = resolve(catalogRoot, definition.sourcePath)
  if (!existsSync(absolutePath)) return null
  const parsed = parsePage(absolutePath, definition.fallbackTitle, definition.order, false)
  return {
    kind: definition.kind,
    section: definition.section,
    sourcePath: definition.sourcePath,
    outputPath: definition.outputPath,
    route: definition.route,
    routeKey: definition.routeKey,
    title: parsed.title,
    navigationTitle: definition.navigationTitle,
    description: parsed.description,
    order: parsed.order,
    inclusion: inclusionForKind(definition.kind)
  }
}

function scanNumberedSection(
  catalogRoot: string,
  directory: 'lectures' | 'extras',
  kind: 'lecture' | 'extra',
  fallback: string
): ContentPage[] {
  const directoryPath = resolve(catalogRoot, 'content', directory)
  if (!existsSync(directoryPath)) return []

  return readdirSync(directoryPath, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')
    )
    .filter((entry) => entry.name !== 'index')
    .map((entry): ContentPage | null => {
      const sourcePath = `content/${directory}/${entry.name}/vitepress.md`
      const absolutePath = resolve(catalogRoot, sourcePath)
      if (!existsSync(absolutePath)) return null
      const directoryOrder = extractNumber(entry.name)
      const parsed = parsePage(absolutePath, fallback, directoryOrder)
      const slug = Number.isFinite(directoryOrder)
        ? String(directoryOrder).padStart(2, '0')
        : basename(entry.name)
      return {
        kind,
        section: directory,
        sourcePath,
        outputPath: `${directory}/${slug}.md`,
        route: `/${directory}/${slug}`,
        routeKey: `${directory}/${slug}`,
        title: parsed.title,
        description: parsed.description,
        order: parsed.order,
        inclusion: inclusionForKind(kind)
      }
    })
    .filter((page): page is ContentPage => page !== null)
}

function parsePage(
  file: string,
  fallback: string,
  directoryOrder: number,
  numberFallback = true
): {
  title: string
  description: string
  order: number
} {
  const { data, content } = matter(readFileSync(file, 'utf8'))
  const order =
    typeof data.order === 'number' && Number.isFinite(data.order) ? data.order : directoryOrder
  const title =
    typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : (content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ??
        (numberFallback && Number.isFinite(order)
          ? `${fallback} ${String(order).padStart(2, '0')}`
          : fallback))
  const description =
    typeof data.description === 'string' && data.description.trim()
      ? data.description.trim()
      : firstParagraph(content)
  return { title, description, order }
}

function firstParagraph(content: string): string {
  return (
    content
      .replace(/^#\s+.+?$/m, '')
      .split(/\n{2,}/)
      .map((part) =>
        part
          .replace(/\s+/g, ' ')
          .replace(/[*_`#[\]]/g, '')
          .trim()
      )
      .find((part) => part.length > 20 && !part.startsWith('---')) ?? ''
  )
}

function extractNumber(name: string): number {
  const match = name.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

function comparePages(left: ContentPage, right: ContentPage): number {
  const kinds: ContentPageKind[] = [
    'home',
    'intro',
    'lecture',
    'extras-index',
    'extra',
    'conclusion',
    'service'
  ]
  return (
    kinds.indexOf(left.kind) - kinds.indexOf(right.kind) ||
    left.order - right.order ||
    left.route.localeCompare(right.route, 'ru')
  )
}

function assertUnique(
  pages: ContentPage[],
  value: (page: ContentPage) => string,
  label: string
): void {
  const seen = new Set<string>()
  for (const page of pages) {
    const key = value(page)
    if (seen.has(key)) throw new Error(`Duplicate content ${label}: ${key}`)
    seen.add(key)
  }
}
