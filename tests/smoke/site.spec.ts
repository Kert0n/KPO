import { expect, test } from '@playwright/test'

test('published application shell and fixture components mount without browser errors', async ({
  page
}) => {
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('status of 404')) {
      issues.push(message.text())
    }
  })

  await page.goto('service-pages/ui-contract')
  await expect(page.locator('.VPNav')).toBeVisible()
  await expect(page.locator('.kpo-switcher').first()).toBeVisible()
  await expect(page.locator('.kpo-mermaid svg').first()).toBeVisible()
  await expect(page.locator('.KpoAskAiProvider').first()).toBeVisible()
  expect(issues).toEqual([])
})
