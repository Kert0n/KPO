import { getContentCatalog } from '../../.vitepress/shared/content/contentCatalog'
import { requireCatalogPage, routePath } from './helpers/catalog'
import { registerConsoleGuard } from './helpers/consoleGuard'
import { expect, test } from './helpers/fixtures'

registerConsoleGuard(test)

const catalog = getContentCatalog()
const routes = [
  requireCatalogPage(catalog, (page) => page.kind === 'intro', 'intro'),
  requireCatalogPage(catalog, (page) => page.kind === 'lecture', 'first lecture'),
  requireCatalogPage(catalog, (page) => page.route === '/extras/02', '/extras/02')
].map(routePath)

for (const route of routes) {
  test(`cross-browser smoke: ${route}`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('.vp-doc')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}
