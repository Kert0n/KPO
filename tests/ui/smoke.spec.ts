import { expect, test } from '@playwright/test'

for (const route of ['intro', 'lectures/01', 'extras/02']) {
  test(`cross-browser smoke: ${route}`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('.vp-doc')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })
}
