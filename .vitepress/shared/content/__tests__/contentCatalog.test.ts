import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { contentPagesFor, getContentCatalog, validateContentCatalog } from '../contentCatalog'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('content catalog', () => {
  it('includes public extras in PDF and UI sweep while excluding home and service from PDF', () => {
    const pdf = contentPagesFor('pdf')
    const uiSweep = contentPagesFor('uiSweep')

    expect(pdf.map((page) => page.route)).toContain('/extras/02')
    expect(uiSweep.map((page) => page.route)).toContain('/extras/02')
    expect(pdf.some((page) => page.kind === 'home')).toBe(false)
    expect(pdf.some((page) => page.kind === 'service')).toBe(false)
  })

  it('honors frontmatter order before the directory number', () => {
    const root = fixtureRoot()
    writePage(root, 'content/lectures/Lec1/vitepress.md', '---\norder: 20\n---\n# Later')
    writePage(root, 'content/lectures/Lec2/vitepress.md', '---\norder: 10\n---\n# Earlier')

    const lectures = getContentCatalog({ root, fresh: true }).filter(
      (page) => page.kind === 'lecture'
    )

    expect(lectures.map((page) => page.title)).toEqual(['Earlier', 'Later'])
    expect(lectures.map((page) => page.route)).toEqual(['/lectures/02', '/lectures/01'])
  })

  it('rejects duplicate section order', () => {
    const catalog = getContentCatalog().map((page) => ({
      ...page,
      inclusion: { ...page.inclusion }
    }))
    const lectures = catalog.filter((page) => page.kind === 'lecture')
    lectures[1].order = lectures[0].order
    expect(() => validateContentCatalog(catalog)).toThrow(/lectures order/)
  })
})

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'kpo-content-catalog-'))
  temporaryRoots.push(root)
  return root
}

function writePage(root: string, path: string, content: string): void {
  const directory = dirname(join(root, path))
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(root, path), content, 'utf8')
}
