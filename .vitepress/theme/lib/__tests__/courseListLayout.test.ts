import { describe, expect, it } from 'vitest'
import type { CourseGroup } from '../../../shared/content/courseMap'
import { arcPath, layoutCourseList } from '../courseListLayout'

const metrics = { partHeight: 50, rowHeight: 40, gutter: 96 }

function groups(sizes: number[]): CourseGroup[] {
  let next = 1
  return sizes.map((size, index) => ({
    id: `p${index}`,
    title: `Часть ${index + 1}`,
    summary: '',
    lectures: Array.from({ length: size }, () => next++)
  }))
}

describe('course list layout', () => {
  it('stacks part headers and lectures in course order', () => {
    const layout = layoutCourseList(groups([2, 1]), metrics)
    expect(layout.rows.map((row) => [row.kind, row.top])).toEqual([
      ['part', 0],
      ['lecture', 50],
      ['lecture', 90],
      ['part', 130],
      ['lecture', 180]
    ])
    expect(layout.height).toBe(220)
    expect(layout.centers.get(3)).toBe(200)
  })

  it('grows only in height for more parts and longer parts', () => {
    const layout = layoutCourseList(groups([6, 1, 5, 4, 3, 7, 2]), metrics)
    expect(layout.rows.filter((row) => row.kind === 'part')).toHaveLength(7)
    expect(layout.centers.size).toBe(28)
    expect(layout.height).toBe(7 * 50 + 28 * 40)
    const tops = layout.rows.map((row) => row.top)
    expect(tops).toEqual([...tops].sort((left, right) => left - right))
  })

  it('keeps every arc inside the gutter, bending more for distant lectures', () => {
    const bend = (path: string) => 92 - Number(path.split(' ')[4].replace(',', ''))
    const near = arcPath(20, 60, 96)
    const far = arcPath(20, 2000, 96)
    expect(bend(near)).toBeLessThan(bend(far))
    expect(bend(far)).toBeLessThanOrEqual(84)
    expect(near.startsWith('M 92 20')).toBe(true)
    expect(near.endsWith('92 60')).toBe(true)
  })
})
