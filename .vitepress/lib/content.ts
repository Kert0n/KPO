import type { DefaultTheme } from 'vitepress'
import { getContentCatalog, extractNumber } from '../shared/content/contentCatalog'

export { extractNumber }

export function getSidebar(): DefaultTheme.Sidebar {
  const catalog = getContentCatalog()
  const lectures = catalog.pages.filter((page) => page.kind === 'lecture' && page.inclusion.sidebar)
  const extras = catalog.pages.filter((page) => page.kind === 'extra' && page.inclusion.sidebar)

  const sidebar: DefaultTheme.SidebarItem[] = [
    { text: 'Начало', items: [{ text: 'Введение', link: '/intro' }] },
    { text: 'Лекции', collapsed: false, items: lectures.map(toSidebarItem) }
  ]

  if (extras.length > 0) {
    sidebar.push({
      text: 'Дополнения',
      collapsed: false,
      items: [{ text: 'О дополнениях', link: '/extras/' }, ...extras.map(toSidebarItem)]
    })
  }

  sidebar.push({ text: 'Финал', items: [{ text: 'Заключение', link: '/conclusion' }] })
  return sidebar
}

export function getNav(): DefaultTheme.NavItem[] {
  const catalog = getContentCatalog()
  const firstLecture = catalog.pages.find((page) => page.kind === 'lecture' && page.inclusion.nav)
  const hasExtras = catalog.pages.some((page) => page.kind === 'extra' && page.inclusion.nav)

  return [
    { text: 'Введение', link: '/intro' },
    { text: 'Лекции', link: firstLecture?.route ?? '/intro', activeMatch: '^/lectures/' },
    ...(hasExtras ? [{ text: 'Дополнения', link: '/extras/', activeMatch: '^/extras/' }] : []),
    { text: 'Заключение', link: '/conclusion' }
  ]
}

export function getRewrites(): Record<string, string> {
  return Object.fromEntries(
    getContentCatalog()
      .pages.filter((page) => page.rewrite)
      .map((page) => [page.rewrite!.from, page.rewrite!.to])
  )
}

export function getFirstLectureLink(): string {
  return getContentCatalog().pages.find((page) => page.kind === 'lecture')?.route ?? '/intro'
}

function toSidebarItem(page: { title: string; route: string }): DefaultTheme.SidebarItem {
  return { text: page.title, link: page.route }
}
