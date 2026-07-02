import type { DefaultTheme } from 'vitepress'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import matter from 'gray-matter'

/**
 * Автоматическое построение сайдбара, навигации и rewrites
 * из файловой системы.
 *
 * Элемент раздела — одно из двух:
 *  - плоский файл `NN.md` (например, extras/01.md);
 *  - папка с публикуемой страницей `vitepress.md` (например,
 *    lectures/Lec1/vitepress.md) — остальное содержимое папки
 *    (черновики, транскрипты, видео) принадлежит редактору
 *    и в сборку не попадает (см. srcExclude в config.mts).
 *
 * Папочные страницы через rewrites получают чистые URL вида
 * /lectures/01 — те же, что у плоских файлов.
 *
 * Порядок: frontmatter `order` → число в имени (Lec7 → 7, 03.md → 3).
 * Заголовок: frontmatter `title` → первый H1 → «Лекция NN»/«Дополнение NN».
 * Добавление и удаление лекций не требует правок конфига.
 */

type Page = {
  text: string
  link: string
  order: number
  /** Для папочных страниц: исходный путь → переписанный (для rewrites) */
  rewrite?: { from: string; to: string }
}

const root = process.cwd()

const sections = [
  { directory: 'lectures', fallback: 'Лекция' },
  { directory: 'extras', fallback: 'Дополнение' }
] as const

export function getSidebar(): DefaultTheme.Sidebar {
  const sidebar: DefaultTheme.SidebarItem[] = [
    {
      text: 'Начало',
      items: [{ text: 'Введение', link: '/intro' }]
    },
    {
      text: 'Лекции',
      collapsed: false,
      items: scanPages('lectures')
    }
  ]

  const extras = scanPages('extras')
  if (extras.length > 0) {
    sidebar.push({
      text: 'Дополнения',
      collapsed: false,
      items: [{ text: 'О дополнениях', link: '/extras/' }, ...extras]
    })
  }

  sidebar.push({
    text: 'Финал',
    items: [{ text: 'Заключение', link: '/conclusion' }]
  })

  return sidebar
}

export function getNav(): DefaultTheme.NavItem[] {
  const nav: DefaultTheme.NavItem[] = [
    { text: 'Введение', link: '/intro' },
    { text: 'Лекции', link: getFirstLectureLink(), activeMatch: '/lectures/' }
  ]

  if (scanPages('extras').length > 0) {
    nav.push({ text: 'Дополнения', link: '/extras/', activeMatch: '/extras/' })
  }

  nav.push({ text: 'Заключение', link: '/conclusion' })

  return nav
}

/** Карта rewrites для папочных страниц: lectures/Lec1/vitepress.md → lectures/01.md */
export function getRewrites(): Record<string, string> {
  const rewrites: Record<string, string> = {}

  for (const section of sections) {
    for (const page of scanPages(section.directory)) {
      if (page.rewrite) rewrites[page.rewrite.from] = page.rewrite.to
    }
  }

  return rewrites
}

export function getFirstLectureLink(): string {
  return scanPages('lectures')[0]?.link ?? '/intro'
}

function scanPages(directory: (typeof sections)[number]['directory']): Page[] {
  const directoryPath = resolve(root, directory)
  if (!existsSync(directoryPath)) return []

  const fallback = sections.find((s) => s.directory === directory)!.fallback

  const pages = readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    .map((entry) => toPage(directory, entry, fallback))
    .filter((page): page is Page => page !== null)
    .sort((a, b) => a.order - b.order || a.link.localeCompare(b.link, 'ru'))

  assertUniqueLinks(directory, pages)

  return pages
}

function toPage(
  directory: string,
  entry: { name: string; isFile(): boolean; isDirectory(): boolean },
  fallback: string
): Page | null {
  if (entry.isFile()) {
    if (!entry.name.endsWith('.md') || entry.name === 'index.md') return null

    const order = extractNumber(entry.name)
    return {
      text: extractTitle(join(root, directory, entry.name), fallback, order),
      link: `/${directory}/${entry.name.replace(/\.md$/, '')}`,
      order
    }
  }

  if (entry.isDirectory()) {
    const source = join(root, directory, entry.name, 'vitepress.md')
    if (!existsSync(source)) return null

    const order = extractNumber(entry.name)
    const slug = Number.isFinite(order) ? String(order).padStart(2, '0') : entry.name

    return {
      text: extractTitle(source, fallback, order),
      link: `/${directory}/${slug}`,
      order,
      rewrite: {
        from: `${directory}/${entry.name}/vitepress.md`,
        to: `${directory}/${slug}.md`
      }
    }
  }

  return null
}

/** Число из имени: «Lec7» → 7, «03.md» → 3; без числа — в конец списка */
function extractNumber(name: string): number {
  const match = name.match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER
}

function extractTitle(file: string, fallback: string, order: number): string {
  const { data, content } = matter(readFileSync(file, 'utf8'))

  if (typeof data.title === 'string' && data.title.trim() !== '') {
    return data.title.trim()
  }

  const h1 = content.match(/^#\s+(.+?)\s*$/m)?.[1]
  if (h1) return h1

  return order === Number.MAX_SAFE_INTEGER
    ? fallback
    : `${fallback} ${String(order).padStart(2, '0')}`
}

function assertUniqueLinks(directory: string, pages: Page[]): void {
  const seen = new Set<string>()
  for (const page of pages) {
    if (seen.has(page.link)) {
      throw new Error(`Дублирующаяся ссылка "${page.link}" в каталоге "${directory}".`)
    }
    seen.add(page.link)
  }
}
