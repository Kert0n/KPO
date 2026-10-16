import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  contributingGuideUrl,
  githubEditUrl,
  githubIssueUrl,
  githubSourceUrl,
  isAnnouncementActive,
  searchableFragment,
  sourcePathFromFilePath
} from '../suggestEditModel'

const repository = { url: 'https://github.com/Kert0n/KPO', branch: 'master' }

describe('suggestEditModel', () => {
  it('maps VitePress filePath to the repository source path', () => {
    expect(sourcePathFromFilePath('lectures/Lec3/vitepress.md')).toBe(
      'content/lectures/Lec3/vitepress.md'
    )
    expect(sourcePathFromFilePath('')).toBe('')
  })

  it('builds editor, source and guide links', () => {
    const source = 'content/lectures/Lec3/vitepress.md'
    expect(githubEditUrl(repository, source)).toBe(
      'https://github.com/Kert0n/KPO/edit/master/content/lectures/Lec3/vitepress.md'
    )
    expect(githubSourceUrl(repository, source, { start: 12, end: 15 })).toBe(
      'https://github.com/Kert0n/KPO/blob/master/content/lectures/Lec3/vitepress.md#L12-L15'
    )
    expect(githubSourceUrl(repository, source, { start: 12, end: 12 })).toMatch(/#L12$/)
    expect(githubSourceUrl(repository, source, { start: 0, end: 0 })).not.toContain('#')
    expect(contributingGuideUrl(repository)).toBe('https://github.com/Kert0n/KPO#как-помочь-курсу')
  })

  it('opens the content-error template with the «Где» section filled in', () => {
    const url = new URL(
      githubIssueUrl(repository, {
        pageTitle: 'Лекция 3. Принципы эффективного юнит-тестирования',
        pageUrl: 'https://course.example.test/KPO/lectures/03#kinds',
        quote: 'первая строка\nвторая строка',
        sourcePath: 'content/lectures/Lec3/vitepress.md',
        lines: { start: 40, end: 42 }
      })
    )

    expect(url.pathname).toBe('/Kert0n/KPO/issues/new')
    expect(url.searchParams.get('template')).toBe('content-error.md')
    expect(url.searchParams.get('title')).toBe('Лекция 3: «первая строка вторая строка»')
    const body = url.searchParams.get('body') ?? ''
    expect(body).toContain('Страница: https://course.example.test/KPO/lectures/03#kinds')
    expect(body).toContain('vitepress.md#L40-L42')
    expect(body).toContain('> первая строка\n> вторая строка')
    // Ссылка с сайта и шаблон в репозитории должны предлагать одни и те же разделы.
    const template = readFileSync(
      fileURLToPath(
        new URL('../../../../.github/ISSUE_TEMPLATE/content-error.md', import.meta.url)
      ),
      'utf8'
    )
    expect(body.match(/^## .+$/gm)).toEqual(template.match(/^## .+$/gm))
    const classLetters = (text: string) =>
      [...text.matchAll(/^- \[ \] ([А-ЯЁ])\./gm)].map((match) => match[1])
    expect(classLetters(body)).toEqual(classLetters(template))
  })

  it('keeps long Cyrillic quotes inside the GitHub URL limit', () => {
    const url = githubIssueUrl(repository, {
      pageTitle: 'Лекция 1',
      pageUrl: 'https://course.example.test/KPO/lectures/01',
      quote: 'слово '.repeat(2000),
      sourcePath: 'content/lectures/Lec1/vitepress.md',
      lines: { start: 100, end: 140 }
    })
    expect(new URL(url).searchParams.get('title')?.length).toBeLessThan(80)
    expect(url.length).toBeLessThan(8000)
  })

  it('picks the longest run that exists verbatim in the source', () => {
    expect(
      searchableFragment(['Mock', ' заранее настроен ожиданиями и сам проверяет', ' с ним.'])
    ).toBe('заранее настроен ожиданиями и сам проверяет')
    expect(searchableFragment(['короткая\nсамая длинная строка здесь'])).toBe(
      'самая длинная строка здесь'
    )
    expect(searchableFragment(['слово '.repeat(40)]).length).toBeLessThanOrEqual(80)
    expect(searchableFragment(['    val total  =  price * count  '])).toBe(
      'val total  =  price * count'
    )
    expect(searchableFragment([])).toBe('')
  })

  it('shows the announcement through the whole last day only', () => {
    expect(isAnnouncementActive(new Date(2026, 9, 31, 23, 0), '2026-10-31')).toBe(true)
    expect(isAnnouncementActive(new Date(2026, 10, 1, 0, 1), '2026-10-31')).toBe(false)
    expect(isAnnouncementActive(new Date(2026, 9, 16), 'broken')).toBe(false)
  })
})
