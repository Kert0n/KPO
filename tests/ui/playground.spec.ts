import { expect, test } from './fixtures'
import {
  ANCHOR_TOLERANCE_PX,
  LAYOUT_VIEWPORTS,
  PLAYGROUND_MODULE_REQUEST,
  UI_FIXTURE_ROUTE,
  expectActiveTab,
  expectNoPageOverflowFromVpDoc,
  expectViewportAnchorRestored,
  expectViewportAnchorStable,
  measureViewportRelativeTo,
  resetComponentStorage,
  setStorage,
  waitForMermaid,
  waitForPageLayoutReady,
  waitForScopedPlayground
} from './helpers/kpoTestSupport'

test('illustrative Kotlin remains visible but cannot start Playground', async ({ page }) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const illustrative = page.locator('.kpo-switcher').filter({ hasText: 'Fixture switcher one' })
  await expectActiveTab(illustrative, 'Kotlin')
  await expect(illustrative.locator('.language-kotlin')).toBeVisible()
  await expect(illustrative.getByRole('button', { name: /Playground/ })).toBeDisabled()

  const runnable = page.locator('.kpo-switcher').filter({ hasText: 'Fixture Kotlin Playground' })
  await expect(runnable.getByRole('button', { name: /Playground/ })).toBeEnabled()
})

test('real clean storage keeps the product Playground default enabled', async ({
  browser
}, testInfo) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto(new URL(UI_FIXTURE_ROUTE, String(testInfo.project.use.baseURL)).href)

  const switcher = page.locator('.kpo-switcher').filter({ hasText: 'Fixture Kotlin Playground' })
  await expect(switcher.getByRole('button', { name: /Playground/ })).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(switcher.locator('.kpo-playground')).toHaveCount(1)
  expect(pageErrors).toEqual([])
  await context.close()
})

test('language click preserves viewport position inside the interacted code block', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(1)
  await waitForPageLayoutReady(page)
  await switcher.evaluate((node) => node.scrollIntoView({ block: 'center' }))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('tab', { name: 'Java' }).click()
  await expectViewportAnchorRestored(before, switcher)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('keyboard language switch preserves viewport position inside the interacted code block', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(1)
  await waitForPageLayoutReady(page)
  await switcher.evaluate((node) => node.scrollIntoView({ block: 'center' }))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('tab', { name: 'Kotlin' }).focus()
  await page.keyboard.press('ArrowRight')
  await expectViewportAnchorRestored(before, switcher)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('playground toggle preserves viewport position inside the interacted code block', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await resetComponentStorage(page)
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').nth(4)
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 260))

  const before = await measureViewportRelativeTo(switcher)
  await switcher.getByRole('button', { name: /Playground/ }).click()
  await waitForScopedPlayground(switcher)
  await expectViewportAnchorRestored(before, switcher)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('enabling a fixture playground preserves its viewport anchor through initialization', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)
  await waitForMermaid(page, { requireDiagrams: true })

  const switcher = page.locator('.kpo-switcher').filter({
    hasText: 'Fixture Kotlin Playground'
  })
  const toggle = switcher.getByRole('button', { name: /Playground/ })
  await toggle.evaluate((node) => node.scrollIntoView({ block: 'center' }))

  const before = await measureViewportRelativeTo(switcher)
  await toggle.click()
  await waitForScopedPlayground(switcher)
  await expectViewportAnchorRestored(before, switcher)
  const after = await measureViewportRelativeTo(switcher)

  await expectViewportAnchorStable(before, after)
  await expectNoPageOverflowFromVpDoc(page)
})

test('Home and End language navigation preserves the anchor around async playground state', async ({
  page
}) => {
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, {
    'kpo:code-language': 'go',
    'kpo:playground-mode': '1'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const switcher = page.locator('.kpo-switcher').filter({
    hasText: 'Fixture Kotlin Playground'
  })
  const goTab = switcher.getByRole('tab', { name: 'Go' })
  await goTab.focus()

  const beforeHome = await measureViewportRelativeTo(switcher)
  await page.keyboard.press('Home')
  await waitForScopedPlayground(switcher)
  await expectViewportAnchorRestored(beforeHome, switcher)
  const afterHome = await measureViewportRelativeTo(switcher)
  await expectViewportAnchorStable(beforeHome, afterHome)

  const beforeEnd = await measureViewportRelativeTo(switcher)
  await page.keyboard.press('End')
  await expectActiveTab(switcher, 'Go')
  await expect(switcher.locator('.kpo-playground:visible')).toHaveCount(0)
  await expectViewportAnchorRestored(beforeEnd, switcher)
  const afterEnd = await measureViewportRelativeTo(switcher)
  await expectViewportAnchorStable(beforeEnd, afterEnd)
  await expectNoPageOverflowFromVpDoc(page)
})

test('user scroll takes ownership while a delayed playground is initializing', async ({ page }) => {
  let releasePlayground!: () => void
  const playgroundGate = new Promise<void>((resolve) => {
    releasePlayground = resolve
  })
  await page.route(PLAYGROUND_MODULE_REQUEST, async (route) => {
    await playgroundGate
    await route.continue()
  })
  await page.setViewportSize(LAYOUT_VIEWPORTS.desktop)
  await setStorage(page, {
    'kpo:code-language': 'go',
    'kpo:playground-mode': '1'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const switcher = page.locator('.kpo-switcher').filter({
    hasText: 'Fixture Kotlin Playground'
  })
  await switcher.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, 240))
  await switcher.getByRole('tab', { name: 'Go' }).focus()

  const playgroundRequest = page.waitForRequest(PLAYGROUND_MODULE_REQUEST)
  await page.keyboard.press('Home')
  await playgroundRequest
  await page.mouse.wheel(0, 360)
  const userOwnedScroll = await page.evaluate(() => window.scrollY)

  releasePlayground()
  await waitForScopedPlayground(switcher)
  const settledScroll = await page.evaluate(() => window.scrollY)
  expect(settledScroll).toBeGreaterThanOrEqual(userOwnedScroll - ANCHOR_TOLERANCE_PX)
})

test('playground toggle keeps stable geometry and availability follows the active tab', async ({
  page
}) => {
  await setStorage(page, {
    'kpo:code-language': 'kotlin',
    'kpo:playground-mode': '0'
  })
  await page.goto(UI_FIXTURE_ROUTE)

  const playgroundSwitcher = page.locator('.kpo-switcher').filter({
    hasText: 'Fixture Kotlin Playground'
  })
  await waitForPageLayoutReady(page)

  await expectActiveTab(playgroundSwitcher, 'Kotlin')
  const toggle = playgroundSwitcher.locator('.kpo-switcher__playground-toggle')
  await expect(toggle).toBeVisible()
  await expect(toggle).toBeEnabled()
  const initialBox = await toggle.boundingBox()

  await playgroundSwitcher.getByRole('tab', { name: 'Java' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expect(toggle).toBeVisible()
  await expect(toggle).toBeDisabled()
  const javaBox = await toggle.boundingBox()
  expect(Math.abs((javaBox?.width ?? 0) - (initialBox?.width ?? 0))).toBeLessThanOrEqual(2)
  expect(javaBox?.height).toBe(initialBox?.height)

  await playgroundSwitcher.getByRole('tab', { name: 'Kotlin' }).click()
  await expectNoPageOverflowFromVpDoc(page)
  await expect(toggle).toBeEnabled()
  const kotlinBox = await toggle.boundingBox()
  expect(Math.abs((kotlinBox?.width ?? 0) - (initialBox?.width ?? 0))).toBeLessThanOrEqual(2)
  expect(kotlinBox?.height).toBe(initialBox?.height)

  const playgroundOff = page.locator('.kpo-switcher').filter({ hasText: 'Fixture playground off' })
  await expect(playgroundOff.locator('.kpo-switcher__playground-toggle')).toHaveCount(0)
})

test('persisted language hydration keeps switcher controls geometrically stable', async ({
  browser,
  page
}, testInfo) => {
  await page.goto(UI_FIXTURE_ROUTE)
  const scenarios = [
    { viewport: { width: 390, height: 844 }, language: 'java', playgroundMode: '1' },
    { viewport: { width: 768, height: 900 }, language: 'go', playgroundMode: '0' },
    { viewport: { width: 800, height: 900 }, language: 'java', playgroundMode: '0' },
    { viewport: { width: 1440, height: 1000 }, language: 'kotlin', playgroundMode: '1' }
  ] as const

  for (const scenario of scenarios) {
    const ssrContext = await browser.newContext({
      javaScriptEnabled: false,
      viewport: scenario.viewport
    })
    const ssrPage = await ssrContext.newPage()
    await ssrPage.goto(new URL(UI_FIXTURE_ROUTE, String(testInfo.project.use.baseURL)).href)
    await ssrPage.evaluate(() => document.fonts.ready)
    const ssrGeometry = await measureSwitcherControlGeometry(
      ssrPage.locator('.kpo-switcher').first()
    )
    await ssrContext.close()

    await page.setViewportSize(scenario.viewport)
    await page.evaluate(({ language, playgroundMode }) => {
      localStorage.setItem('kpo:code-language', language)
      localStorage.setItem('kpo:playground-mode', playgroundMode)
    }, scenario)
    await page.goto(UI_FIXTURE_ROUTE)

    const switcher = page.locator('.kpo-switcher').first()
    const runnable = page.locator('.kpo-switcher').filter({ hasText: 'Fixture Kotlin Playground' })
    await expectActiveTab(
      switcher,
      scenario.language === 'kotlin' ? 'Kotlin' : scenario.language === 'java' ? 'Java' : 'Go'
    )
    if (scenario.language === 'kotlin' && scenario.playgroundMode === '1') {
      await expect(switcher.locator('.kpo-switcher__playground-toggle')).toBeDisabled()
      await waitForScopedPlayground(runnable)
    } else {
      await expect(page.locator('.kpo-playground:visible')).toHaveCount(0)
      const toggle = switcher.locator('.kpo-switcher__playground-toggle')
      await expect(toggle).toBeVisible()
      await expect(toggle).toBeDisabled()
    }

    await expectNoPageOverflowFromVpDoc(page)
    const hydratedGeometry = await measureSwitcherControlGeometry(switcher)
    expect(hydratedGeometry, JSON.stringify(scenario)).toEqual(ssrGeometry)
  }
})

async function measureSwitcherControlGeometry(switcher: import('@playwright/test').Locator) {
  return switcher.evaluate((node) => {
    const header = node.querySelector('.kpo-switcher__header')?.getBoundingClientRect()
    const controls = node.querySelector('.kpo-switcher__controls')?.getBoundingClientRect()
    const toggle = node.querySelector('.kpo-switcher__playground-toggle')?.getBoundingClientRect()
    const dimensions = (rect: DOMRect | undefined) => ({
      width: Math.round(rect?.width ?? 0),
      height: Math.round(rect?.height ?? 0)
    })
    return {
      header: dimensions(header),
      controls: dimensions(controls),
      toggle: dimensions(toggle)
    }
  })
}
