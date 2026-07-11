import type { DefaultTheme } from 'vitepress'
import {
  contentPagesFor,
  getCatalogRewrites,
  getContentCatalog
} from '../shared/content/contentCatalog'

export function getSidebar(): DefaultTheme.Sidebar {
  const lectures = sectionItems('lectures')
  const extras = sectionItems('extras')

  return [
    { text: 'Начало', items: [{ text: page('/intro').title, link: '/intro' }] },
    { text: 'Лекции', collapsed: false, items: lectures },
    ...(extras.length > 0
      ? [
          {
            text: 'Дополнения',
            collapsed: false,
            items: [{ text: navigationTitle(page('/extras/')), link: '/extras/' }, ...extras]
          }
        ]
      : []),
    { text: 'Финал', items: [{ text: page('/conclusion').title, link: '/conclusion' }] }
  ] satisfies DefaultTheme.SidebarItem[]
}

export function getNav(): DefaultTheme.NavItem[] {
  return [
    { text: 'Введение', link: '/intro' },
    { text: 'Лекции', link: getFirstLectureLink(), activeMatch: '^/lectures/' },
    { text: 'Дополнения', link: page('/extras/').route, activeMatch: '^/extras/' },
    { text: 'Заключение', link: '/conclusion' }
  ]
}

export function getRewrites(): Record<string, string> {
  return getCatalogRewrites()
}

export function getFirstLectureLink(): string {
  return getContentCatalog().find((item) => item.kind === 'lecture')?.route ?? '/intro'
}

export function extractNumber(name: string): number {
  const match = name.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

function sectionItems(section: 'lectures' | 'extras'): DefaultTheme.SidebarItem[] {
  return contentPagesFor('sidebar')
    .filter((item) => item.section === section && item.kind !== 'extras-index')
    .map((item) => ({ text: navigationTitle(item), link: item.route }))
}

function page(route: string) {
  const result = getContentCatalog().find((item) => item.route === route)
  if (!result) throw new Error(`Missing content page: ${route}`)
  return result
}

function navigationTitle(item: ReturnType<typeof page>): string {
  return item.navigationTitle ?? item.title
}
