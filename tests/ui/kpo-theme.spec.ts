import { expect, test, type Locator, type Page } from '@playwright/test'

async function clearStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear()
  })
}

async function setStorage(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, value)
    }
  }, entries)
}

async function expectActiveTab(switcher: Locator, language: string): Promise<void> {
  await expect(switcher.locator('.kpo-switcher__tab--active')).toHaveText(language)
}

test('code switchers without author defaults follow the latest global language', async ({ page }) => {
  await clearStorage(page)
  await page.goto('lectures/02')

  const switchers = page.locator('.kpo-switcher')
  await expect.poll(async () => switchers.count()).toBeGreaterThan(3)

  await switchers.nth(0).getByRole('tab', { name: 'Java' }).click()

  await expectActiveTab(switchers.nth(0), 'Java')
  await expectActiveTab(switchers.nth(1), 'Java')
  await expectActiveTab(switchers.nth(2), 'Java')

  await switchers.nth(1).getByRole('tab', { name: 'Kotlin' }).click()

  await expectActiveTab(switchers.nth(0), 'Kotlin')
  await expectActiveTab(switchers.nth(1), 'Kotlin')
  await expectActiveTab(switchers.nth(2), 'Kotlin')
})

test('author default beats restored language until that block is clicked', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto('extras/01')

  const switcher = page.locator('.kpo-switcher').first()
  await expectActiveTab(switcher, 'Go')
  await expect(page.locator('.kpo-playground')).toHaveCount(0)

  await switcher.getByRole('tab', { name: 'Kotlin' }).click()

  await expectActiveTab(switcher, 'Kotlin')
  await expect(page.locator('.kpo-playground')).toHaveCount(1)
})

test('lecture 13 renders mermaid and keeps playground disabled for marked blocks', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto('lectures/13')

  await page.waitForFunction(() => {
    const diagrams = [...document.querySelectorAll('.kpo-mermaid')]
    return diagrams.length > 0 && diagrams.every((diagram) => diagram.querySelector('svg'))
  })

  await expect(page.locator('.kpo-mermaid__error')).toHaveCount(0)
  await expect(page.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)
  await expect(page.locator('.kpo-playground')).toHaveCount(0)
})

test('lecture 02 mobile layout has no pdf text code overflow', async ({ page }) => {
  await page.setViewportSize({ width: 414, height: 896 })
  await clearStorage(page)
  await page.goto('lectures/02')

  await expect(page.locator('.language-text').filter({
    hasText: 'Пример функционального тестирования'
  })).toHaveCount(0)

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(hasHorizontalOverflow).toBe(false)
})

test('sidebar toggle does not navigate away from the current page', async ({ page }) => {
  await page.goto('lectures/13')

  const beforeUrl = page.url()
  const html = page.locator('html')
  const wasHidden = await html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))

  await page.locator('.kpo-sidebar-toggle').click()

  await expect(page).toHaveURL(beforeUrl)
  await expect.poll(async () => {
    return html.evaluate((node) => node.classList.contains('kpo-sidebar-hidden'))
  }).toBe(!wasHidden)
})

test('last updated footer uses european date with AM PM time', async ({ page }) => {
  await page.goto('lectures/02')

  await expect(page.locator('.VPLastUpdated')).toContainText(
    /Обновлено:\s+\d{2}\.\d{2}\.\d{2},\s+\d{2}:\d{2}\s+(AM|PM)/
  )
})
