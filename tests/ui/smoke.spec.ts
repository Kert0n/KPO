import { expect, test } from '@playwright/test'
import { getContentCatalog } from '../../.vitepress/shared/content/contentCatalog'
import { registerConsoleGuard } from './helpers/consoleGuard'

registerConsoleGuard(test)

const catalog = getContentCatalog()
const routes = [
  catalog.pages.find((page) => page.kind === 'intro'),
  catalog.pages.find((page) => page.kind === 'lecture'),
  catalog.pages.find((page) => page.route === '/extras/02')
].flatMap((page) => (page ? [page.route.replace(/^\//, '')] : []))

for (const route of routes) {
  test(`cross-browser smoke: ${route}`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('.vp-doc')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}
