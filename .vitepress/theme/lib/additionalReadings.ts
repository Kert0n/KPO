import matter from 'gray-matter'

export type AdditionalReadingItem = {
  title: string
  url: string
  note?: string
}

export type AdditionalReadingGroup = {
  title: string
  items: AdditionalReadingItem[]
}

export type LectureAdditionalReadings = {
  lecture: number
  title: string
  url: string
  groups: AdditionalReadingGroup[]
}

const additionalReadingsHeading = 'Дополнительное чтение'

export function extractAdditionalReadingsSection(markdown: string): string | null {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim() === `## ${additionalReadingsHeading}`)
  if (start === -1) return null

  const end = lines.findIndex((line, index) => {
    return index > start && /^##\s+\S/.test(line)
  })

  const sectionLines = lines.slice(start + 1, end === -1 ? undefined : end)
  const section = sectionLines.join('\n').trim()

  return section === '' ? null : section
}

export function parseAdditionalReadingsSection(section: string): AdditionalReadingGroup[] {
  const groups: AdditionalReadingGroup[] = []
  let currentGroup: AdditionalReadingGroup | null = null

  for (const line of section.split(/\r?\n/)) {
    const groupTitle = line.match(/^###\s+(.+?)\s*$/)?.[1]?.trim()
    if (groupTitle) {
      currentGroup = { title: groupTitle, items: [] }
      groups.push(currentGroup)
      continue
    }

    const item = parseReadingItem(line)
    if (!item) continue

    if (!currentGroup) {
      currentGroup = { title: 'Материалы', items: [] }
      groups.push(currentGroup)
    }

    currentGroup.items.push(item)
  }

  return groups.filter((group) => group.items.length > 0)
}

export function parseLectureAdditionalReadings(filePath: string, markdown: string): LectureAdditionalReadings | null {
  const lecture = extractLectureNumber(filePath)
  if (lecture === null) return null

  const section = extractAdditionalReadingsSection(markdown)
  if (!section) return null

  const groups = parseAdditionalReadingsSection(section)
  if (groups.length === 0) return null

  const title = extractLectureTitle(markdown, lecture)

  return {
    lecture,
    title,
    url: `/lectures/${String(lecture).padStart(2, '0')}`,
    groups
  }
}

function parseReadingItem(line: string): AdditionalReadingItem | null {
  const match = line.match(/^\s*-\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)(?:\s+—\s+(.+?))?\s*$/)
  if (!match) return null

  const [, title, url, note] = match

  return {
    title: title.trim(),
    url: url.trim(),
    ...(note?.trim() ? { note: note.trim() } : {})
  }
}

function extractLectureNumber(filePath: string): number | null {
  const match = filePath.replace(/\\/g, '/').match(/\/?Lec(\d+)\/vitepress\.md$/)
  if (!match) return null

  return Number.parseInt(match[1], 10)
}

function extractLectureTitle(markdown: string, lecture: number): string {
  const { data, content } = matter(markdown)

  const rawTitle = typeof data.title === 'string' && data.title.trim() !== ''
    ? data.title.trim()
    : content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim()

  if (!rawTitle) return `Лекция ${lecture}`

  return rawTitle.replace(new RegExp(`^Лекция\\s+${lecture}\\.\\s*`, 'i'), '').trim()
}
