import type { DefaultTheme } from 'vitepress'
import {
  contentPagesFor,
  getCatalogRewrites,
  getContentCatalog
} from '../shared/content/contentCatalog'
import type { ContentPage } from '../shared/content/contentTypes'

export function getSidebar(): DefaultTheme.Sidebar {
  return buildSidebar(contentPagesFor('sidebar'))
}

export function buildSidebar(pages: ContentPage[]): DefaultTheme.Sidebar {
  const lectures = sectionItems(pages, 'lectures')
  const extras = sectionItems(pages, 'extras')

  return [
    { text: 'Начало', items: [{ text: page(pages, '/intro').title, link: '/intro' }] },
    { text: 'Лекции', collapsed: false, items: lectures },
    ...(extras.length > 0
      ? [
          {
            text: 'Дополнения',
            collapsed: false,
            items: [{ text: navigationTitle(page(pages, '/extras/')), link: '/extras/' }, ...extras]
          }
        ]
      : []),
    { text: 'Финал', items: [{ text: page(pages, '/conclusion').title, link: '/conclusion' }] }
  ] satisfies DefaultTheme.SidebarItem[]
}

export function getNav(): DefaultTheme.NavItem[] {
  return buildNav(getContentCatalog())
}

export function buildNav(pages: ContentPage[]): DefaultTheme.NavItem[] {
  return [
    { text: 'Введение', link: '/intro' },
    { text: 'Лекции', link: firstLectureLink(pages), activeMatch: '^/lectures/' },
    { text: 'Дополнения', link: page(pages, '/extras/').route, activeMatch: '^/extras/' },
    { text: 'Заключение', link: '/conclusion' }
  ]
}

export function getRewrites(): Record<string, string> {
  return getCatalogRewrites()
}

export function buildRewrites(pages: ContentPage[]): Record<string, string> {
  return Object.fromEntries(
    pages.map((item) => [item.sourcePath.replace(/^content\//, ''), item.outputPath])
  )
}

export function getFirstLectureLink(): string {
  return firstLectureLink(getContentCatalog())
}

export function extractNumber(name: string): number {
  const match = name.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

function sectionItems(
  pages: ContentPage[],
  section: 'lectures' | 'extras'
): DefaultTheme.SidebarItem[] {
  return pages
    .filter((item) => item.section === section && item.kind !== 'extras-index')
    .map((item) => ({ text: navigationTitle(item), link: item.route }))
}

function page(pages: ContentPage[], route: string) {
  const result = pages.find((item) => item.route === route)
  if (!result) throw new Error(`Missing content page: ${route}`)
  return result
}

function navigationTitle(item: ContentPage): string {
  return item.navigationTitle ?? item.title
}

function firstLectureLink(pages: ContentPage[]): string {
  return pages.find((item) => item.kind === 'lecture')?.route ?? '/intro'
}
