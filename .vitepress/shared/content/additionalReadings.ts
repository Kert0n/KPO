import MarkdownIt from 'markdown-it'
import type { ContentPage } from './contentTypes'

export type AdditionalReadingItem = {
  title: string
  url: string
  note?: string
}

export type AdditionalReadingGroup = {
  title: string
  items: AdditionalReadingItem[]
}

export type ContentAdditionalReadings = {
  sourceKind: 'lecture' | 'extra'
  order: number
  title: string
  route: string
  anchor: string
  groups: AdditionalReadingGroup[]
}

type LocatedSection = {
  markdown: string
  lineOffset: number
}

type GroupState = AdditionalReadingGroup & {
  line: number
}

const markdown = new MarkdownIt({ html: false })
const acceptedHeadings = new Set(['дополнительное чтение', 'источники для дальнейшего чтения'])

export function extractAdditionalReadingsSection(source: string): string | null {
  return locateAdditionalReadingsSection(source, '<markdown>')?.markdown ?? null
}

export function parseAdditionalReadingsSection(section: string): AdditionalReadingGroup[] {
  return parseSection(section, '<additional-readings>', 0)
}

export function parseContentAdditionalReadings(
  page: ContentPage,
  source: string
): ContentAdditionalReadings | null {
  if (page.kind !== 'lecture' && page.kind !== 'extra') return null

  const section = locateAdditionalReadingsSection(source, page.sourcePath)
  if (!section) return null

  return {
    sourceKind: page.kind,
    order: page.order,
    title: page.title,
    route: page.route,
    anchor: `${page.kind === 'lecture' ? 'lecture' : 'article'}-${page.order}`,
    groups: parseSection(section.markdown, page.sourcePath, section.lineOffset)
  }
}

export function collectAdditionalReadings(
  pages: ContentPage[],
  readSource: (page: ContentPage) => string
): ContentAdditionalReadings[] {
  const readings = pages
    .filter((page) => page.kind === 'lecture' || page.kind === 'extra')
    .map((page) => parseContentAdditionalReadings(page, readSource(page)))
    .filter((item): item is ContentAdditionalReadings => item !== null)
    .sort(compareReadings)

  assertUnique(readings, (item) => item.route, 'route')
  assertUnique(readings, (item) => item.anchor, 'anchor')
  return readings
}

function locateAdditionalReadingsSection(
  source: string,
  sourcePath: string
): LocatedSection | null {
  const tokens = markdown.parse(source, {})
  const headings = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token, index }) => {
      return (
        token.type === 'heading_open' &&
        token.tag === 'h2' &&
        token.level === 0 &&
        isAcceptedHeading(tokens[index + 1]?.content ?? '')
      )
    })

  if (headings.length === 0) return null
  if (headings.length > 1) {
    const line = (headings[1].token.map?.[0] ?? 0) + 1
    fail(sourcePath, line, 'duplicate additional readings section')
  }

  const heading = headings[0]
  const sectionStart = heading.token.map?.[1] ?? 0
  const nextH2 = tokens.slice(heading.index + 1).find((token) => {
    return token.type === 'heading_open' && token.tag === 'h2' && token.level === 0
  })
  const sectionEnd = nextH2?.map?.[0] ?? source.split(/\r?\n/).length

  return {
    markdown: source.split(/\r?\n/).slice(sectionStart, sectionEnd).join('\n'),
    lineOffset: sectionStart
  }
}

function parseSection(
  section: string,
  sourcePath: string,
  lineOffset: number
): AdditionalReadingGroup[] {
  const tokens = markdown.parse(section, {})
  const groups: GroupState[] = []
  let currentGroup: GroupState | null = null

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token.type === 'heading_open' && token.tag === 'h3' && token.level === 0) {
      currentGroup = {
        title: tokens[index + 1]?.content.trim() || 'Материалы',
        items: [],
        line: lineOffset + (token.map?.[0] ?? 0) + 1
      }
      groups.push(currentGroup)
      continue
    }

    if (token.type !== 'bullet_list_open' || token.level !== 0) continue

    const listEnd = findClosingToken(tokens, index, 'bullet_list_open', 'bullet_list_close')
    for (let itemIndex = index + 1; itemIndex < listEnd; itemIndex += 1) {
      const itemToken = tokens[itemIndex]
      if (itemToken.type !== 'list_item_open' || itemToken.level !== 1) continue

      const itemEnd = findClosingToken(tokens, itemIndex, 'list_item_open', 'list_item_close')
      const itemLine = lineOffset + (itemToken.map?.[0] ?? 0) + 1
      const inline = tokens.slice(itemIndex + 1, itemEnd).find((candidate) => {
        return candidate.type === 'inline' && candidate.level === 3
      })
      const item = parseReadingItem(inline?.children ?? [], sourcePath, itemLine)

      if (!currentGroup) {
        currentGroup = { title: 'Материалы', items: [], line: itemLine }
        groups.push(currentGroup)
      }
      currentGroup.items.push(item)
      itemIndex = itemEnd
    }
    index = listEnd
  }

  if (groups.length === 0) {
    fail(sourcePath, lineOffset + 1, 'additional readings section has no valid items')
  }
  for (const group of groups) {
    if (group.items.length === 0) {
      fail(sourcePath, group.line, `additional readings group "${group.title}" has no items`)
    }
  }

  return groups.map(({ title, items }) => ({ title, items }))
}

function parseReadingItem(
  children: NonNullable<ReturnType<MarkdownIt['parse']>[number]['children']>,
  sourcePath: string,
  line: number
): AdditionalReadingItem {
  const firstMeaningful = children.findIndex((token) => token.type !== 'softbreak')
  const linkOpen = children[firstMeaningful]
  if (!linkOpen || linkOpen.type !== 'link_open') {
    fail(sourcePath, line, 'additional reading item must start with a Markdown link')
  }

  const linkClose = children.findIndex(
    (token, index) => index > firstMeaningful && token.type === 'link_close'
  )
  if (linkClose === -1) fail(sourcePath, line, 'additional reading link is not closed')

  const url = linkOpen.attrGet('href')?.trim() ?? ''
  if (!isHttpUrl(url)) {
    fail(sourcePath, line, `additional reading URL must use http or https: ${url || '(empty)'}`)
  }

  const title = tokenText(children.slice(firstMeaningful + 1, linkClose)).trim()
  if (!title) fail(sourcePath, line, 'additional reading link has no title')

  const note = tokenText(children.slice(linkClose + 1))
    .replace(/^\s*(?:—|-)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim()

  return { title, url, ...(note ? { note } : {}) }
}

function tokenText(
  tokens: NonNullable<ReturnType<MarkdownIt['parse']>[number]['children']>
): string {
  return tokens
    .map((token) => {
      if (token.type === 'text' || token.type === 'code_inline') return token.content
      if (token.type === 'softbreak' || token.type === 'hardbreak') return ' '
      return ''
    })
    .join('')
}

function findClosingToken(
  tokens: ReturnType<MarkdownIt['parse']>,
  start: number,
  openType: string,
  closeType: string
): number {
  let depth = 0
  for (let index = start; index < tokens.length; index += 1) {
    if (tokens[index].type === openType) depth += 1
    if (tokens[index].type === closeType) depth -= 1
    if (depth === 0) return index
  }
  return tokens.length - 1
}

function isAcceptedHeading(value: string): boolean {
  return acceptedHeadings.has(value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru'))
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function compareReadings(
  left: ContentAdditionalReadings,
  right: ContentAdditionalReadings
): number {
  const kindRank = { lecture: 0, extra: 1 } as const
  return (
    kindRank[left.sourceKind] - kindRank[right.sourceKind] ||
    left.order - right.order ||
    left.route.localeCompare(right.route, 'ru')
  )
}

function assertUnique(
  readings: ContentAdditionalReadings[],
  value: (item: ContentAdditionalReadings) => string,
  label: string
): void {
  const seen = new Set<string>()
  for (const item of readings) {
    const key = value(item)
    if (seen.has(key)) fail(item.route, 1, `duplicate additional readings ${label}: ${key}`)
    seen.add(key)
  }
}

function fail(sourcePath: string, line: number, message: string): never {
  throw new Error(`${sourcePath}:${line}: ${message}`)
}
