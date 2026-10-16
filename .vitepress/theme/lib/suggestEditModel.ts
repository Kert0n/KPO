/**
 * Ссылки «Предложить правку»: редактор GitHub, issue с цитатой и раздел README.
 * Чистые функции без DOM, чтобы покрыть их юнит-тестами.
 */

export type RepositoryRef = {
  url: string
  branch: string
}

export type SourceLines = {
  start: number
  end: number
}

export type IssueDraft = {
  pageTitle: string
  pageUrl: string
  quote: string
  sourcePath: string
  lines?: SourceLines
}

/** Анонс кнопки показывается до этой даты включительно (две недели после релиза). */
export const SUGGEST_EDIT_ANNOUNCEMENT_UNTIL = '2026-10-31'

const ISSUE_TEMPLATE = 'content-error.md'
/**
 * Классы правок в коротком виде: полные пояснения есть в шаблоне, а здесь они удлинили бы
 * URL на несколько килобайт кириллицы. Буквы разбирает scripts/edit-class-labels.mts.
 */
export const EDIT_CLASS_TITLES = [
  'А. Форма',
  'Б. Ошибка',
  'В. Устарело',
  'Г. Неверная модель',
  'Д. Дискуссионно',
  'Е. Подача',
  'Ж. Согласованность',
  'З. Новый материал'
] as const
const ISSUE_TITLE_QUOTE_LIMIT = 60
// Кириллица в URL занимает 6 символов на букву, а GitHub не принимает адреса длиннее ~8 КБ.
const ISSUE_QUOTE_LIMIT = 400
const SEARCH_FRAGMENT_LIMIT = 80

/** VitePress отдаёт filePath относительно srcDir (`content`). */
export function sourcePathFromFilePath(filePath: string): string {
  return filePath ? `content/${filePath.replace(/^\/+/, '')}` : ''
}

export function githubEditUrl(repository: RepositoryRef, sourcePath: string): string {
  return `${repository.url}/edit/${repository.branch}/${encodePath(sourcePath)}`
}

export function githubSourceUrl(
  repository: RepositoryRef,
  sourcePath: string,
  lines?: SourceLines
): string {
  const base = `${repository.url}/blob/${repository.branch}/${encodePath(sourcePath)}`
  if (!lines || lines.start <= 0) return base
  return lines.end > lines.start
    ? `${base}#L${lines.start}-L${lines.end}`
    : `${base}#L${lines.start}`
}

export function contributingGuideUrl(repository: RepositoryRef): string {
  return `${repository.url}#как-помочь-курсу`
}

/**
 * Issue по шаблону «Ошибка в конспекте» (.github/ISSUE_TEMPLATE/content-error.md).
 * Тело повторяет разделы шаблона: «Где» заполнен, остальное — подсказки читателю.
 */
export function githubIssueUrl(repository: RepositoryRef, draft: IssueDraft): string {
  const flatQuote = normalizeSpaces(draft.quote)
  // «Лекция 3. Принципы …» → «Лекция 3»: заголовок issue и так длинный из-за цитаты.
  const page = draft.pageTitle.split('. ')[0]
  const title = `${page}: «${clip(flatQuote, ISSUE_TITLE_QUOTE_LIMIT)}»`
  const quoteLines = clip(draft.quote.trim(), ISSUE_QUOTE_LIMIT)
    .split('\n')
    .map((line) => `> ${line}`.trimEnd())
  const body = [
    '## Где',
    '',
    `Страница: ${draft.pageUrl}`,
    `Исходник: ${githubSourceUrl(repository, draft.sourcePath, draft.lines)}`,
    '',
    ...quoteLines,
    '',
    '## Класс',
    '',
    '<!-- Отметьте один пункт: [x]. Не уверены — ближайший, мейнтейнер поправит. -->',
    '',
    ...EDIT_CLASS_TITLES.map((title) => `- [ ] ${title}`),
    '',
    '## Что не так',
    '',
    '<!-- Наблюдаемое, а не «как-то неудачно». Для опечатки достаточно одной строки. -->',
    '',
    '## Как должно быть',
    '',
    '<!-- Ваш вариант. Спорную позицию не заменяют, а дополняют блоком «Дискуссионно». -->',
    '',
    '## Чем подтверждается',
    '',
    '<!-- Первичный источник или вывод компилятора. Ответ нейросети источником не считается. -->',
    ''
  ].join('\n')
  const query = [
    `template=${ISSUE_TEMPLATE}`,
    `title=${encodeURIComponent(title)}`,
    `body=${encodeURIComponent(body)}`
  ].join('&')
  return `${repository.url}/issues/new?${query}`
}

/**
 * Что положить в буфер для поиска в редакторе GitHub.
 *
 * Выделение на странице — это отрендеренный текст: в исходнике между его
 * кусками стоят `**`, ссылки и обратные кавычки, и целиком он не найдётся.
 * Самый длинный непрерывный текстовый узел почти всегда есть в исходнике
 * дословно, поэтому ищем по нему. Пробелы внутри строки не трогаем: в коде
 * выравнивание значимо, и сжатая строка в исходнике уже не найдётся.
 */
export function searchableFragment(runs: readonly string[]): string {
  let best = ''
  for (const run of runs) {
    for (const line of run.split('\n')) {
      const candidate = line.trim()
      if (candidate.length > best.length) best = candidate
    }
  }
  return clipAtWord(best, SEARCH_FRAGMENT_LIMIT)
}

export function isAnnouncementActive(now: Date, until: string): boolean {
  const [year, month, day] = until.split('-').map(Number)
  if (!year || !month || !day) return false
  const lastMoment = new Date(year, month - 1, day, 23, 59, 59, 999)
  return now.getTime() <= lastMoment.getTime()
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text
}

function clipAtWord(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()
}
