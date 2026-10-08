import { describe, expect, it } from 'vitest'
import { buildCourseMap } from '../courseMap'
import type { ContentPage } from '../contentTypes'

describe('course map', () => {
  it('strips the lecture prefix, keeps known lectures in groups and lists extras', () => {
    const pages = [
      lecture(1, 'Лекция 1. Введение', ''),
      lecture(2, 'Лекция 2. DI', ''),
      { ...lecture(1, 'Песочница', ''), kind: 'extra' as const, route: '/extras/01' }
    ]
    const map = buildCourseMap(pages, () => '', [
      { id: 'g', title: 'Группа', summary: '', lectures: [1, 2, 9] }
    ])

    expect(map.lectures.map((item) => item.title)).toEqual(['Введение', 'DI'])
    expect(map.groups[0].lectures).toEqual([1, 2])
    expect(map.groups).toHaveLength(1)
    expect(map.extras).toEqual([{ title: 'Песочница', route: '/extras/01' }])
  })

  it('rejects a lecture listed in two parts', () => {
    const pages = [1, 2].map((n) => lecture(n, `Лекция ${n}. Тема`, ''))
    expect(() =>
      buildCourseMap(pages, () => '', [
        { id: 'a', title: 'A', summary: '', lectures: [1, 2] },
        { id: 'b', title: 'B', summary: '', lectures: [2] }
      ])
    ).toThrow(/lecture 2 is in "a" and "b"/)
  })

  it('puts lectures missing from every part into an extra column', () => {
    const pages = [1, 2, 3].map((n) => lecture(n, `Лекция ${n}. Тема`, ''))
    const map = buildCourseMap(pages, () => '', [
      { id: 'g', title: 'Группа', summary: '', lectures: [1] }
    ])
    expect(map.groups.map((group) => [group.title, group.lectures])).toEqual([
      ['Группа', [1]],
      ['Другие лекции', [2, 3]]
    ])
  })
})

describe('reading paths', () => {
  const build = (count: number, frontmatter: Record<number, string>) =>
    buildCourseMap(
      Array.from({ length: count }, (_, i) => lecture(i + 1, `Лекция ${i + 1}. Тема`, '')),
      (page) => (frontmatter[page.order] ? `---\n${frontmatter[page.order]}\n---\n` : '')
    )

  it('keeps only maximal paths of a linear chain', () => {
    const map = build(3, { 2: 'requires: [1]', 3: 'requires: [2]' })
    expect(map.readingPaths).toEqual([{ target: 3, path: [1, 2, 3] }])
    expect(map.startHere).toEqual([1])
  })

  it('lists every branch of a tree and the lectures without preparation', () => {
    const map = build(5, { 2: 'requires: [1]', 3: 'requires: [1]', 5: 'requires: [3, 4]' })
    expect(map.readingPaths).toEqual([
      { target: 2, path: [1, 2] },
      { target: 5, path: [1, 3, 4, 5] }
    ])
    expect(map.startHere).toEqual([1, 4])
  })

  it('follows a long transitive chain', () => {
    const frontmatter = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [i + 2, `requires: [${i + 1}]`])
    )
    const map = build(8, frontmatter)
    expect(map.readingPaths).toEqual([{ target: 8, path: [1, 2, 3, 4, 5, 6, 7, 8] }])
  })
})

describe('lecture dependencies from frontmatter', () => {
  const pages = [1, 2, 3, 4].map((n) => lecture(n, `Лекция ${n}. Тема ${n}`, ''))
  const build = (frontmatter: Record<number, string>) =>
    buildCourseMap(pages, (page) => {
      const yaml = frontmatter[page.order]
      return yaml ? `---\n${yaml}\n---\n\n# ${page.title}` : `# ${page.title}`
    })

  it('builds the transitive closure of required lectures in reading order', () => {
    const map = build({
      2: 'requires: [1]',
      3: 'requires:\n  - lecture: 2\n    reason: сценарий продолжается',
      4: 'requires: [3]\nrecommends:\n  - lecture: 1\n    reason: контекст'
    })
    expect(map.lectures.map((item) => item.prerequisites)).toEqual([[], [1], [1, 2], [1, 2, 3]])
    expect(map.lectures[2].requires).toEqual([{ lecture: 2, reason: 'сценарий продолжается' }])
    expect(map.lectures[3].recommends).toEqual([{ lecture: 1, reason: 'контекст' }])
  })

  it('reports every violation with the source path', () => {
    const run = () =>
      build({
        2: 'requires: [3]',
        3: 'requires: [1]\nrecommends: [1, 9]',
        4: 'requires: 2\nrecommends:\n  - title: нет номера'
      })
    expect(run).toThrow(/Lec2\/vitepress\.md: requires lecture 3 is not earlier than lecture 2/)
    expect(run).toThrow(/Lec3\/vitepress\.md: lecture 1 is listed more than once/)
    expect(run).toThrow(/Lec3\/vitepress\.md: recommends lecture 9 does not exist/)
    expect(run).toThrow(/Lec4\/vitepress\.md: frontmatter "requires" must be a list/)
    expect(run).toThrow(/Lec4\/vitepress\.md: recommends\[0\] must be a lecture number/)
  })
})

function lecture(order: number, title: string, description: string): ContentPage {
  const slug = String(order).padStart(2, '0')
  return {
    kind: 'lecture',
    section: 'lectures',
    sourcePath: `content/lectures/Lec${order}/vitepress.md`,
    outputPath: `lectures/${slug}.md`,
    route: `/lectures/${slug}`,
    routeKey: `lectures/${slug}`,
    title,
    description,
    order,
    inclusion: {
      nav: true,
      sidebar: true,
      search: true,
      askAi: true,
      pdf: true,
      uiSweep: true,
      sitemap: true
    }
  }
}
