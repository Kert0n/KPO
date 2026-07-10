import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import matter from 'gray-matter'
import { defaultInclusion } from './contentPolicy'
import type { ContentCatalog, ContentPage, ContentPageKind } from './contentTypes'

type Frontmatter = Record<string, unknown>

const catalogCache = new Map<string, ContentCatalog>()

export function getContentCatalog(root = process.cwd()): ContentCatalog {
  const normalizedRoot = resolve(root)
  const cached = catalogCache.get(normalizedRoot)
  if (cached) return cached

  const pages = [
    staticPage(normalizedRoot, 'home/vitepress.md', '/', 'home', 0),
    staticPage(normalizedRoot, 'intro/vitepress.md', 'intro', 'intro', 0),
    ...scanSection(normalizedRoot, 'lectures', 'lecture'),
    staticPage(normalizedRoot, 'extras/index/vitepress.md', 'extras/', 'extras-index', 0),
    ...scanSection(normalizedRoot, 'extras', 'extra'),
    staticPage(normalizedRoot, 'conclusion/vitepress.md', 'conclusion', 'conclusion', 0),
    staticPage(normalizedRoot, 'service-pages/ui-contract/vitepress.md', 'service-pages/ui-contract', 'service', 0)
  ].filter((page): page is ContentPage => page !== null)

  assertUnique(pages, (page) => page.route, 'route')
  assertUniqueOrders(pages)

  const ordered = pages.sort(comparePages)
  const catalog: ContentCatalog = {
    pages: ordered,
    publicPages: ordered.filter((page) => page.inclusion.sitemap)
  }
  catalogCache.set(normalizedRoot, catalog)
  return catalog
}

export function clearContentCatalogCache(): void {
  catalogCache.clear()
}

export function getPageByRouteKey(catalog: ContentCatalog, routeKey: string): ContentPage | null {
  return catalog.pages.find((page) => page.routeKey === routeKey) ?? null
}

export function getPdfPages(catalog = getContentCatalog()): ContentPage[] {
  return orderedCoursePages(catalog.pages.filter((page) => page.inclusion.pdf))
}

export function getUiSweepPages(catalog = getContentCatalog()): ContentPage[] {
  return orderedCoursePages(catalog.pages.filter((page) => page.inclusion.uiSweep))
}

export function extractNumber(name: string): number {
  const match = name.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

function staticPage(
  root: string,
  sourcePath: string,
  route: string,
  kind: ContentPageKind,
  fallbackOrder: number
): ContentPage | null {
  const file = resolve(root, 'content', sourcePath)
  if (!existsSync(file)) return null
  return pageFromFile(root, file, sourcePath, route, kind, fallbackOrder, {
    from: sourcePath,
    to: routeToOutput(route)
  })
}

function scanSection(root: string, directory: 'lectures' | 'extras', kind: 'lecture' | 'extra'): ContentPage[] {
  const sectionPath = resolve(root, 'content', directory)
  if (!existsSync(sectionPath)) return []

  return readdirSync(sectionPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'index' && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    .map((entry) => {
      const sourcePath = `${directory}/${entry.name}/vitepress.md`
      const file = join(sectionPath, entry.name, 'vitepress.md')
      if (!existsSync(file)) return null
      const fallbackOrder = extractNumber(entry.name)
      const slug = Number.isFinite(fallbackOrder) ? String(fallbackOrder).padStart(2, '0') : entry.name
      const route = `${directory}/${slug}`
      return pageFromFile(root, file, sourcePath, route, kind, fallbackOrder, {
        from: sourcePath,
        to: `${directory}/${slug}.md`
      })
    })
    .filter((page): page is ContentPage => page !== null)
}

function pageFromFile(
  root: string,
  file: string,
  sourcePath: string,
  route: string,
  kind: ContentPageKind,
  fallbackOrder: number,
  rewrite: NonNullable<ContentPage['rewrite']>
): ContentPage {
  const { data, content } = matter(readFileSync(file, 'utf8'))
  const frontmatter = data as Frontmatter
  const routeKey = route === '/'
    ? 'index'
    : route.endsWith('/')
      ? `${route.replace(/^\/+|\/$/g, '')}/index`
      : route.replace(/^\/+/, '')
  const order = frontmatterOrder(frontmatter, fallbackOrder, relative(root, file))
  const inclusion = {
    ...defaultInclusion(kind),
    ...frontmatterInclusion(frontmatter)
  }

  return {
    kind,
    sourcePath: `content/${sourcePath}`,
    route: route === '/' ? '/' : `/${route}`.replace(/\/$/, kind === 'extras-index' ? '/' : ''),
    routeKey,
    title: pageTitle(frontmatter, content, fallbackTitle(kind, order)),
    description: pageDescription(frontmatter, content),
    order,
    inclusion,
    rewrite
  }
}

function frontmatterOrder(frontmatter: Frontmatter, fallback: number, file: string): number {
  if (frontmatter.order === undefined) return fallback
  if (typeof frontmatter.order !== 'number' || !Number.isFinite(frontmatter.order)) {
    throw new Error(`Invalid frontmatter order in ${file}: expected a finite number.`)
  }
  return frontmatter.order
}

function frontmatterInclusion(frontmatter: Frontmatter): Partial<ContentPage['inclusion']> {
  if (frontmatter.pdf !== undefined && typeof frontmatter.pdf !== 'boolean') {
    throw new Error('Invalid frontmatter pdf: expected a boolean.')
  }
  return frontmatter.pdf === undefined ? {} : { pdf: frontmatter.pdf }
}

function pageTitle(frontmatter: Frontmatter, content: string, fallback: string): string {
  if (typeof frontmatter.title === 'string' && frontmatter.title.trim() !== '') return frontmatter.title.trim()
  return content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ?? fallback
}

function pageDescription(frontmatter: Frontmatter, content: string): string {
  if (typeof frontmatter.description === 'string' && frontmatter.description.trim() !== '') {
    return frontmatter.description.trim()
  }

  return content
    .replace(/^#\s+.+?$/m, '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[`*_>#|]/g, ' ').replace(/\s+/g, ' ').trim())
    .find((paragraph) => paragraph.length > 20)
    ?? ''
}

function fallbackTitle(kind: ContentPageKind, order: number): string {
  if (kind === 'lecture' && Number.isFinite(order)) return `Лекция ${String(order).padStart(2, '0')}`
  if (kind === 'extra' && Number.isFinite(order)) return `Дополнение ${String(order).padStart(2, '0')}`
  return 'Материал курса'
}

function routeToOutput(route: string): string {
  if (route === '/' || route === 'index') return 'index.md'
  if (route.endsWith('/')) return `${route}index.md`
  return `${route}.md`
}

function assertUnique<T>(items: T[], key: (item: T) => string, label: string): void {
  const seen = new Set<string>()
  for (const item of items) {
    const value = key(item)
    if (seen.has(value)) throw new Error(`Duplicate ${label}: ${value}`)
    seen.add(value)
  }
}

function assertUniqueOrders(pages: ContentPage[]): void {
  for (const kind of ['lecture', 'extra'] as const) {
    const relevant = pages.filter((page) => page.kind === kind)
    const seen = new Set<number>()
    for (const page of relevant) {
      if (!Number.isFinite(page.order)) continue
      if (seen.has(page.order)) throw new Error(`Duplicate ${kind} order: ${page.order}`)
      seen.add(page.order)
    }
  }
}

function comparePages(a: ContentPage, b: ContentPage): number {
  return a.kind.localeCompare(b.kind) || a.order - b.order || a.route.localeCompare(b.route, 'ru')
}

function orderedCoursePages(pages: readonly ContentPage[]): ContentPage[] {
  const rank: Record<ContentPageKind, number> = {
    home: 0,
    intro: 1,
    lecture: 2,
    'extras-index': 3,
    extra: 4,
    conclusion: 5,
    service: 6
  }
  return [...pages].sort((a, b) => rank[a.kind] - rank[b.kind] || a.order - b.order || a.route.localeCompare(b.route, 'ru'))
}
