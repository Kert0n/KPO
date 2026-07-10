import { describe, expect, it } from 'vitest'
import { getContentCatalog, getPdfPages, getUiSweepPages } from './contentCatalog'

describe('content catalog', () => {
  const catalog = getContentCatalog()

  it('uses stable public routes and excludes service pages from public channels', () => {
    expect(catalog.pages.find((page) => page.route === '/service-pages/ui-contract')?.inclusion).toMatchObject({
      pdf: false,
      askAi: false,
      sitemap: false
    })
    expect(catalog.pages.find((page) => page.route === '/lectures/01')?.sourcePath)
      .toBe('content/lectures/Lec1/vitepress.md')
    expect(catalog.pages.find((page) => page.route === '/extras/')?.routeKey).toBe('extras/index')
  })

  it('includes every public extra in PDF and the UI route sweep', () => {
    expect(getPdfPages(catalog).map((page) => page.route)).toContain('/extras/02')
    expect(getUiSweepPages(catalog).map((page) => page.route)).toContain('/extras/02')
  })

  it('prefers frontmatter order over a directory number', () => {
    const extra = catalog.pages.find((page) => page.route === '/extras/02')
    expect(extra?.order).toBe(2)
  })
})
