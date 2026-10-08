import matter from 'gray-matter'
import type { ContentPage } from './contentTypes'

export type CourseLecture = {
  number: number
  /** Название без префикса «Лекция N.» */
  title: string
  route: string
  /** Frontmatter `requires`: без этих лекций текст не понять */
  requires: LectureDependency[]
  /** Frontmatter `recommends`: лекция объясняет нужное сама, но с этим контекстом читать легче */
  recommends: LectureDependency[]
  /** Транзитивное замыкание requires в порядке чтения */
  prerequisites: number[]
}

export type LectureDependency = {
  lecture: number
  reason: string
}

export type CourseGroup = {
  id: string
  title: string
  summary: string
  lectures: number[]
}

export type CoursePageLink = {
  title: string
  route: string
}

/** Обязательный путь к лекции: её prerequisites в порядке чтения и сама лекция последней */
export type ReadingPath = {
  target: number
  path: number[]
}

export type CourseMap = {
  lectures: CourseLecture[]
  groups: CourseGroup[]
  /** Максимальные обязательные пути: путь, целиком входящий в более длинный, не повторяется */
  readingPaths: ReadingPath[]
  /** Лекции без обязательной подготовки */
  startHere: number[]
  extras: CoursePageLink[]
}

/** Части курса на главной: колонки карты и плитки узкой раскладки */
export const COURSE_GROUPS: CourseGroup[] = [
  {
    id: 'design',
    title: 'Основы проектирования',
    summary: 'Принципы дизайна, внедрение зависимостей и юнит-тесты.',
    lectures: [1, 2, 3]
  },
  {
    id: 'patterns',
    title: 'Паттерны GoF',
    summary: 'Порождающие, поведенческие и структурные паттерны.',
    lectures: [4, 5, 6]
  },
  {
    id: 'architecture',
    title: 'Архитектура и хранение',
    summary: 'DDD, эволюция enterprise-архитектур и выбор СУБД.',
    lectures: [7, 8, 9]
  },
  {
    id: 'services',
    title: 'Взаимодействие сервисов',
    summary: 'Синхронный и асинхронный обмен, отказоустойчивость.',
    lectures: [10, 11, 12]
  },
  {
    id: 'operations',
    title: 'Данные и эксплуатация',
    summary: 'Кэш и CQRS, DevOps, SRE и наблюдаемость.',
    lectures: [13, 14]
  }
]

type DependencyKind = 'requires' | 'recommends'
const DEPENDENCY_KINDS: DependencyKind[] = ['requires', 'recommends']

export function buildCourseMap(
  pages: ContentPage[],
  readSource: (page: ContentPage) => string,
  groups: CourseGroup[] = COURSE_GROUPS
): CourseMap {
  const problems: string[] = []
  const sourcePaths = new Map<number, string>()
  const parsed = pages
    .filter((page) => page.kind === 'lecture')
    .sort((left, right) => left.order - right.order)
    .map((page): CourseLecture => {
      const dependencies = readLectureDependencies(readSource(page), page.sourcePath)
      problems.push(...dependencies.problems)
      sourcePaths.set(page.order, page.sourcePath)
      return {
        number: page.order,
        title: page.title.replace(/^Лекция\s+\d+\.\s*/, ''),
        route: page.route,
        requires: dependencies.requires,
        recommends: dependencies.recommends,
        prerequisites: []
      }
    })

  const linked = applyDependencies(parsed, sourcePaths)
  problems.push(...linked.problems, ...duplicateGroupLectures(groups))
  if (problems.length > 0) {
    throw new Error(`Lecture dependency violations:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  }

  const known = new Set(parsed.map((lecture) => lecture.number))
  const placed = groups
    .map((group) => ({ ...group, lectures: group.lectures.filter((n) => known.has(n)) }))
    .filter((group) => group.lectures.length > 0)
  // Лекция, которую ещё не добавили ни в одну часть, не пропадает с карты
  const assigned = new Set(placed.flatMap((group) => group.lectures))
  const unassigned = [...known].filter((number) => !assigned.has(number))
  if (unassigned.length > 0) {
    placed.push({ id: 'other', title: 'Другие лекции', summary: '', lectures: unassigned })
  }
  return {
    lectures: linked.lectures,
    groups: placed,
    readingPaths: readingPaths(linked.lectures),
    startHere: linked.lectures
      .filter((lecture) => lecture.prerequisites.length === 0)
      .map((lecture) => lecture.number),
    extras: pages
      .filter((page) => page.kind === 'extra')
      .sort((left, right) => left.order - right.order)
      .map((page) => ({ title: page.title, route: page.route }))
  }
}

/**
 * Зависимости лекции из её frontmatter. Элемент списка — номер лекции или
 * `{ lecture, reason }`; ошибки формы возвращаются с путём к файлу.
 */
export function readLectureDependencies(
  source: string,
  sourcePath: string
): Record<DependencyKind, LectureDependency[]> & { problems: string[] } {
  const { data } = matter(source)
  const problems: string[] = []
  const result = { requires: [] as LectureDependency[], recommends: [] as LectureDependency[] }
  for (const kind of DEPENDENCY_KINDS) {
    const raw: unknown = data[kind]
    if (raw === undefined || raw === null) continue
    if (!Array.isArray(raw)) {
      problems.push(`${sourcePath}: frontmatter "${kind}" must be a list`)
      continue
    }
    raw.forEach((item: unknown, index) => {
      const dependency = toDependency(item)
      if (dependency) result[kind].push(dependency)
      else
        problems.push(
          `${sourcePath}: ${kind}[${index}] must be a lecture number or { lecture, reason }`
        )
    })
  }
  return { ...result, problems }
}

function toDependency(item: unknown): LectureDependency | null {
  if (Number.isInteger(item)) return { lecture: item as number, reason: '' }
  if (typeof item !== 'object' || item === null) return null
  const { lecture, reason } = item as { lecture?: unknown; reason?: unknown }
  if (!Number.isInteger(lecture)) return null
  if (reason !== undefined && typeof reason !== 'string') return null
  return { lecture: lecture as number, reason: reason?.trim() ?? '' }
}

/**
 * Связывает лекции по зависимостям. Зависеть можно только от более ранних лекций:
 * так граф гарантированно ацикличен, а порядок чтения совпадает с нумерацией курса.
 */
export function applyDependencies(
  lectures: CourseLecture[],
  sourcePaths: Map<number, string>
): { lectures: CourseLecture[]; problems: string[] } {
  const known = new Set(lectures.map((lecture) => lecture.number))
  const problems: string[] = []
  for (const lecture of lectures) {
    const file = sourcePaths.get(lecture.number)
    const seen = new Set<number>()
    for (const kind of DEPENDENCY_KINDS) {
      for (const { lecture: target } of lecture[kind]) {
        if (!known.has(target)) {
          problems.push(`${file}: ${kind} lecture ${target} does not exist`)
        } else if (target >= lecture.number) {
          problems.push(
            `${file}: ${kind} lecture ${target} is not earlier than lecture ${lecture.number}`
          )
        } else if (seen.has(target)) {
          problems.push(`${file}: lecture ${target} is listed more than once`)
        }
        seen.add(target)
      }
    }
  }

  const byNumber = new Map(lectures.map((lecture) => [lecture.number, lecture]))
  const closure = new Map<number, number[]>()
  const prerequisitesOf = (number: number): number[] => {
    const cached = closure.get(number)
    if (cached) return cached
    const result = new Set<number>()
    for (const { lecture } of byNumber.get(number)?.requires ?? []) {
      if (!known.has(lecture) || lecture >= number) continue
      result.add(lecture)
      for (const transitive of prerequisitesOf(lecture)) result.add(transitive)
    }
    const sorted = [...result].sort((left, right) => left - right)
    closure.set(number, sorted)
    return sorted
  }

  return {
    lectures: lectures.map((lecture) => ({
      ...lecture,
      prerequisites: prerequisitesOf(lecture.number)
    })),
    problems
  }
}

export function readingPaths(lectures: CourseLecture[]): ReadingPath[] {
  const candidates = lectures
    .filter((lecture) => lecture.prerequisites.length > 0)
    .map((lecture) => ({
      target: lecture.number,
      path: [...lecture.prerequisites, lecture.number]
    }))
  return candidates.filter(
    (candidate) =>
      !candidates.some(
        (other) =>
          other.path.length > candidate.path.length &&
          candidate.path.every((number) => other.path.includes(number))
      )
  )
}

/** Лекция может стоять только в одной части: иначе на карте у неё две строки и дуги к одной из них */
function duplicateGroupLectures(groups: CourseGroup[]): string[] {
  const owners = new Map<number, string>()
  const problems: string[] = []
  for (const group of groups) {
    for (const number of group.lectures) {
      const owner = owners.get(number)
      if (owner !== undefined) {
        problems.push(
          `COURSE_GROUPS (.vitepress/shared/content/courseMap.ts): lecture ${number} is in "${owner}" and "${group.id}"`
        )
      } else {
        owners.set(number, group.id)
      }
    }
  }
  return problems
}
