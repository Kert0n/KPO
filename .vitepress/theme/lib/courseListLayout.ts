import type { CourseGroup } from '../../shared/content/courseMap'

/**
 * Раскладка карты курса на главной: лекции идут сверху вниз в порядке курса,
 * сгруппированные по частям, зависимости рисуются дугами в левом поле.
 *
 * Высоты строк фиксированы, поэтому координаты дуг считаются без измерения DOM
 * и одинаково выходят на сервере и в браузере. Любое число частей, лекций в части
 * и связей меняет только высоту списка — ширина и шрифт остаются прежними.
 */
export type CourseListMetrics = {
  partHeight: number
  rowHeight: number
  /** Ширина поля дуг слева от строк */
  gutter: number
}

export const COURSE_LIST_METRICS: CourseListMetrics = {
  partHeight: 52,
  rowHeight: 52,
  gutter: 96
}

export type CourseListRow =
  | { kind: 'part'; key: string; group: CourseGroup; partIndex: number; top: number }
  | { kind: 'lecture'; key: string; number: number; partIndex: number; top: number }

export type CourseListLayout = {
  rows: CourseListRow[]
  height: number
  /** Вертикальный центр строки лекции — точка крепления дуг */
  centers: Map<number, number>
}

export function layoutCourseList(
  groups: CourseGroup[],
  metrics: CourseListMetrics = COURSE_LIST_METRICS
): CourseListLayout {
  const rows: CourseListRow[] = []
  const centers = new Map<number, number>()
  let top = 0
  groups.forEach((group, partIndex) => {
    rows.push({ kind: 'part', key: `part-${group.id}`, group, partIndex, top })
    top += metrics.partHeight
    for (const number of group.lectures) {
      rows.push({ kind: 'lecture', key: `lecture-${number}`, number, partIndex, top })
      centers.set(number, top + metrics.rowHeight / 2)
      top += metrics.rowHeight
    }
  })
  return { rows, height: top, centers }
}

/**
 * Дуга от строки-источника к строке-цели вдоль левого края строк. Чем дальше
 * строки, тем сильнее изгиб, но не шире поля: короткие связи остаются у края,
 * длинные огибают их снаружи и не пересекают текст.
 */
export function arcPath(fromY: number, toY: number, gutter: number): string {
  const edge = gutter - 4
  const distance = Math.abs(toY - fromY)
  const bend = Math.min(gutter - 12, 10 + Math.sqrt(distance) * 3.2)
  return `M ${edge} ${fromY} C ${edge - bend} ${fromY}, ${edge - bend} ${toY}, ${edge} ${toY}`
}
