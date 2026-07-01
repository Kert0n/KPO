import type { DefaultTheme } from 'vitepress'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'

export type SidebarPage = {
  text: string
  link: string
  order: number
  file: string
}

type Frontmatter = {
  title?: string
  order?: number
}

const root = process.cwd()

export function getLecturePages(): SidebarPage[] {
  return getPages('lectures')
}

export function getExtraPages(): SidebarPage[] {
  return getPages('extras', { ignoreIndex: true })
}

export function getFirstLectureLink(): string {
  return getLecturePages()[0]?.link ?? '/intro'
}

export function getSidebar(): DefaultTheme.Sidebar {
  return [
    {
      text: 'Начало',
      items: [
        { text: 'Введение', link: '/intro' },
        { text: 'Hello World', link: '/hello-world' }
      ]
    },
    {
      text: 'Лекции',
      items: getLecturePages()
    },
    {
      text: 'Дополнительные материалы',
      items: getExtraPages()
    },
    {
      text: 'Финал',
      items: [{ text: 'Заключение', link: '/conclusion' }]
    }
  ]
}

function getPages(directory: string, options: { ignoreIndex?: boolean } = {}): SidebarPage[] {
  const directoryPath = resolve(root, directory)

  if (!existsSync(directoryPath)) {
    return []
  }

  const pages = readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) => file.endsWith('.md'))
    .filter((file) => !file.startsWith('_'))
    .filter((file) => file !== 'README.md')
    .filter((file) => !(options.ignoreIndex && file === 'index.md'))
    .map((file) => toSidebarPage(directory, file))

  assertUniqueLinks(pages)

  return pages.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return a.file.localeCompare(b.file, 'ru')
  })
}

function toSidebarPage(directory: string, file: string): SidebarPage {
  const absoluteFile = join(root, directory, file)
  const source = readFileSync(absoluteFile, 'utf8')
  const { frontmatter, body } = parseFrontmatter(source)
  const numericPrefix = Number(file.match(/^(\d+)[-_]/)?.[1])
  const order: number = typeof frontmatter.order === 'number' && Number.isFinite(frontmatter.order)
    ? frontmatter.order
    : Number.isFinite(numericPrefix)
      ? numericPrefix
      : Number.MAX_SAFE_INTEGER

  return {
    text: frontmatter.title ?? extractH1(body) ?? humanizeFileName(file),
    link: toCleanLink(absoluteFile),
    order,
    file: normalizePath(relative(root, absoluteFile))
  }
}

function parseFrontmatter(source: string): { frontmatter: Frontmatter; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)

  if (!match) {
    return { frontmatter: {}, body: source }
  }

  const frontmatter: Frontmatter = {}
  const raw = match[1]

  for (const line of raw.split(/\r?\n/)) {
    const [, key, value] = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/) ?? []

    if (!key) continue

    const normalizedValue = value.trim().replace(/^['"]|['"]$/g, '')

    if (key === 'title') {
      frontmatter.title = normalizedValue
    }

    if (key === 'order') {
      const order = Number(normalizedValue)
      if (Number.isFinite(order)) frontmatter.order = order
    }
  }

  return {
    frontmatter,
    body: source.slice(match[0].length)
  }
}

function extractH1(source: string): string | undefined {
  return source.match(/^#\s+(.+)$/m)?.[1]?.trim()
}

function humanizeFileName(file: string): string {
  return file
    .replace(/\.md$/, '')
    .replace(/^\d+[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('ru-RU'))
}

function toCleanLink(absoluteFile: string): string {
  const relativeFile = normalizePath(relative(root, absoluteFile))
  return `/${relativeFile.replace(/\.md$/, '')}`
}

function normalizePath(filePath: string): string {
  return filePath.split(sep).join(posix.sep)
}

function assertUniqueLinks(pages: SidebarPage[]): void {
  const links = new Map<string, string>()

  for (const page of pages) {
    const duplicate = links.get(page.link)
    if (duplicate) {
      throw new Error(`Duplicate VitePress link "${page.link}" for "${duplicate}" and "${page.file}".`)
    }

    links.set(page.link, page.file)
  }
}
