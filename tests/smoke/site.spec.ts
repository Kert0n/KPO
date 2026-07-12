import { expect, test } from '@playwright/test'
import { stubUiServiceAskAiContext } from '../helpers/serviceFixtures'

test('published application shell and fixture components mount without browser errors', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('kpo:playground-mode', '0')
    localStorage.setItem('kpo:code-language', 'kotlin')
    localStorage.setItem('kpo:ask-ai-provider', 'chatgpt')
  })
  await stubUiServiceAskAiContext(page)
  const issues: string[] = []
  page.on('pageerror', (error) => issues.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(message.text())
  })

  await page.goto('service-pages/ui-contract')
  await expect(page.locator('.VPNav')).toBeVisible()
  await expect(page.locator('.kpo-switcher').first()).toBeVisible()
  await expect(page.locator('.kpo-mermaid svg').first()).toBeVisible()
  await expect(page.locator('.KpoAskAiProvider').first()).toBeVisible()
  expect(issues).toEqual([])
})
