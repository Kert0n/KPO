import { expect, test } from './fixtures'
import {
  UI_FIXTURE_ROUTE,
  expectActiveTab,
  expectNoGlobalOverflowMask,
  expectNoPageOverflowFromVpDoc,
  resetComponentStorage,
  setStorage,
  waitForMermaid
} from './helpers/kpoTestSupport'

test('code switchers without author defaults follow the latest global language', async ({
  page
}) => {
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })
  await expectNoGlobalOverflowMask(page)
  await expectNoPageOverflowFromVpDoc(page)

  const switchers = page.locator('.kpo-switcher')
  await expect.poll(async () => switchers.count()).toBeGreaterThan(3)

  await switchers.nth(0).getByRole('tab', { name: 'Java' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switchers.nth(0), 'Java')
  await expectActiveTab(switchers.nth(1), 'Java')
  await expectActiveTab(switchers.nth(2), 'Java')

  await switchers.nth(1).getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switchers.nth(0), 'Kotlin')
  await expectActiveTab(switchers.nth(1), 'Kotlin')
  await expectActiveTab(switchers.nth(2), 'Kotlin')
})

test('fixture switchers honor persisted global language without author defaults', async ({
  page
}) => {
  await setStorage(page, {
    'kpo:code-language': 'java',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const switchers = page.locator('.kpo-switcher')
  await expect.poll(async () => switchers.count()).toBeGreaterThan(3)

  for (let index = 0; index < 3; index += 1) {
    await expectActiveTab(switchers.nth(index), 'Java')
  }

  await expectNoPageOverflowFromVpDoc(page)
})

test('author default beats restored language until that block is clicked', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '1'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const switcher = page.locator('.kpo-switcher').nth(3)
  await expectActiveTab(switcher, 'Go')
  await expectNoPageOverflowFromVpDoc(page)

  await switcher.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(switcher, 'Kotlin')
  await expectNoPageOverflowFromVpDoc(page)
})

test('released author-default block follows subsequent global language changes', async ({
  page
}) => {
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)

  const switchers = page.locator('.kpo-switcher')
  const authorDefault = switchers.nth(3)

  await expectActiveTab(authorDefault, 'Go')

  await authorDefault.getByRole('tab', { name: 'Java' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(authorDefault, 'Java')
  await expectActiveTab(switchers.nth(0), 'Java')

  await switchers.nth(1).getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)

  await expectActiveTab(authorDefault, 'Kotlin')
  await expectActiveTab(switchers.nth(0), 'Kotlin')
})

test('intentional author default remains protected until clicked', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const authorDefault = page.locator('.kpo-switcher').filter({
    hasText: 'Fixture author default'
  })
  const firstSwitcher = page.locator('.kpo-switcher').first()

  await expectActiveTab(authorDefault, 'Go')
  await expectActiveTab(firstSwitcher, 'Kotlin')

  await authorDefault.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expectActiveTab(authorDefault, 'Kotlin')

  await firstSwitcher.getByRole('tab', { name: 'Go' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expectActiveTab(authorDefault, 'Go')
})

test('language-only text follows global language used by ordinary code switchers', async ({
  page
}) => {
  await setStorage(page, {
    'kpo:code-language': 'java',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const firstSwitcher = page.locator('.kpo-switcher').first()
  await expectActiveTab(firstSwitcher, 'Java')

  await page.locator('.vp-doc').evaluate((content) => {
    const kotlin = document.createElement('div')
    kotlin.className = 'kpo-only kpo-only--kotlin'
    kotlin.textContent = 'fixture-kotlin-only'
    const java = document.createElement('div')
    java.className = 'kpo-only kpo-only--java'
    java.textContent = 'fixture-java-only'
    content.append(kotlin, java)
  })

  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.kpoLang ?? ''))
    .toBe('java')
  await expect(
    page.locator('.kpo-only--java').filter({ hasText: 'fixture-java-only' })
  ).toBeVisible()
  await expect(
    page.locator('.kpo-only--kotlin').filter({ hasText: 'fixture-kotlin-only' })
  ).toBeHidden()
  await expectNoPageOverflowFromVpDoc(page)
})
