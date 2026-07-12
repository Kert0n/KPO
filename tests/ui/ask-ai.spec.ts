import { expect, test } from './fixtures'
import {
  LAYOUT_VIEWPORTS,
  SELECTION_FIRST_TEXT,
  SELECTION_MIDDLE_TEXT,
  SELECTION_NESTED_TEXT,
  SELECTION_TERMINAL_TEXT,
  ASK_AI_FIXTURE_ROUTE,
  UI_FIXTURE_ROUTE,
  dispatchAskAiBoundarySelection,
  mountAskAiBoundaryFixture,
  openAskAiMenuWhenReady,
  resetComponentStorage,
  selectAskAiProviderDesktop,
  selectTextAndClickAskAiMenuItem,
  selectTextAndOpenAskAiMenu,
  setStorage,
  stubAskAiSideEffects,
  stubClipboardFailure,
  stubSelectionBoundaryAskAiContext,
  stubUiServiceAskAiContext,
  waitForAskAiBoundaryFixture,
  waitForPageLayoutReady
} from './helpers/kpoTestSupport'
import type { SelectionBoundaryScenario } from './helpers/kpoTestSupport'

test('desktop ask ai provider uses vitepress flyout pattern', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Введение' })).toBeVisible()
  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Лекции' })).toBeVisible()
  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Дополнения' })).toBeVisible()
  await expect(page.locator('.VPNavBar .VPNavBarMenuLink', { hasText: 'Заключение' })).toBeVisible()
  await expect(page.locator('.VPNavBar .KpoAskAiProvider')).toBeVisible()
  await expect(page.locator('.VPNavBar .kpo-ai-provider__trigger')).toHaveCount(0)

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await expect(flyout).toHaveClass(/VPFlyout/)
  const button = flyout.locator('button[aria-label="Спросить ИИ"]')
  await expect(button).toBeVisible()
  await expect(button.locator('.vpi-sparkles')).toBeVisible()

  await flyout.hover()
  const menu = flyout.locator('.VPMenu')
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('СПРОСИТЬ ИИ')
  await expect(menu).toContainText('ChatGPT')
  await expect(menu).toContainText('Claude')
  await expect(menu).toContainText('DeepSeek')
  await expect(menu).toContainText('Копировать промпт')
})

test('desktop ask ai flyout uses default vitepress hover and open behavior', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  const button = flyout.locator('button[aria-label="Спросить ИИ"]')
  const menu = flyout.locator('.VPMenu')

  await expect(button).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()

  await flyout.hover()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()

  await page.mouse.move(1, 1)
  await expect
    .poll(async () => {
      return button.getAttribute('aria-expanded')
    })
    .toBe('false')
  await expect(menu).toBeHidden()
})

test('ask ai provider selected from vitepress flyout persists', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await selectAskAiProviderDesktop(page, 'Claude')

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  const menu = flyout.locator('.VPMenu')
  const chatGpt = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'ChatGPT' })
  const claude = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' })
  const deepSeek = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' })
  await expect(menu).toBeVisible()
  await expect(claude).toHaveAttribute('aria-checked', 'true')
  await expect(chatGpt).toHaveAttribute('aria-checked', 'false')
  await expect(deepSeek).toHaveAttribute('aria-checked', 'false')
  await expect(claude.locator('.KpoAskAiProviderMenu__check')).toBeVisible()
  await expect(menu.locator('.KpoAskAiProviderMenu__item[aria-checked="true"]')).toHaveCount(1)
})

test('desktop ask ai flyout has a vertical divider separating it from navigation', async ({
  page
}) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await expect(flyout).toBeVisible()

  const pseudo = await flyout.evaluate((node) => {
    const style = getComputedStyle(node, '::before')
    return {
      content: style.content,
      width: style.width,
      height: style.height,
      backgroundColor: style.backgroundColor
    }
  })

  expect(pseudo.content).toBe('""')
  expect(pseudo.width).toBe('1px')
  expect(pseudo.height).toBe('24px')
  expect(pseudo.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
})

test('medium breakpoint hides ask ai flyout and shows it inside extra menu', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await expect(page.locator('.VPNavBar .KpoAskAiProvider')).toBeHidden()

  const extra = page.locator('.VPNavBar .KpoNavBarExtra')
  await expect(extra).toBeVisible()

  await expect(page.locator('.VPNavBar .VPNavBarExtra.extra')).toBeHidden()

  await extra.hover()
  const menu = extra.locator('.VPMenu')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('СПРОСИТЬ ИИ')
  await expect(menu).toContainText('ChatGPT')
  await expect(menu).toContainText('Claude')
  await expect(menu).toContainText('DeepSeek')
  await expect(menu).toContainText('Копировать промпт')

  await expect(extra.locator('.VPSwitchAppearance')).toBeVisible()
})

test('medium breakpoint ask ai provider selection syncs with desktop flyout', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1000, height: 800 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  const extra = page.locator('.VPNavBar .KpoNavBarExtra')
  await extra.hover()
  await extra.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' }).click()

  await page.setViewportSize({ width: 1600, height: 900 })
  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  const deepSeek = flyout.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' })
  await expect(deepSeek).toHaveAttribute('aria-checked', 'true')
  await expect(flyout.locator('.KpoAskAiProviderMenu__item[aria-checked="true"]')).toHaveCount(1)
})

test('ask ai provider menu keeps selected and hover states clear', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  const flyout = page.locator('.VPNavBar .KpoAskAiProvider')
  await flyout.hover()
  const menu = flyout.locator('.VPMenu')
  const chatGpt = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'ChatGPT' })
  const claude = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' })
  const deepSeek = menu.locator('.KpoAskAiProviderMenu__item', { hasText: 'DeepSeek' })
  await expect(chatGpt).toHaveAttribute('aria-checked', 'true')
  await expect(claude).toHaveAttribute('aria-checked', 'false')
  await expect(chatGpt.locator('.KpoAskAiProviderMenu__check')).toBeVisible()

  const menuBackground = await menu.evaluate((node) => getComputedStyle(node).backgroundColor)
  const selectedBackground = await chatGpt.evaluate(
    (node) => getComputedStyle(node).backgroundColor
  )
  const selectedColor = await chatGpt.evaluate((node) => getComputedStyle(node).color)
  const claudeBackground = await claude.evaluate((node) => getComputedStyle(node).backgroundColor)
  const claudeColor = await claude.evaluate((node) => getComputedStyle(node).color)
  const deepSeekBackground = await deepSeek.evaluate(
    (node) => getComputedStyle(node).backgroundColor
  )
  expect(selectedBackground).toBe(claudeBackground)
  expect(deepSeekBackground).toBe(claudeBackground)
  expect(selectedColor).not.toBe(claudeColor)

  await claude.hover()
  await expect
    .poll(async () => {
      return claude.evaluate((node) => getComputedStyle(node).backgroundColor)
    })
    .not.toBe(claudeBackground)
  await deepSeek.hover()
  await expect
    .poll(async () => {
      return deepSeek.evaluate((node) => getComputedStyle(node).backgroundColor)
    })
    .not.toBe(menuBackground)
  const deepSeekHoverBackground = await deepSeek.evaluate(
    (node) => getComputedStyle(node).backgroundColor
  )
  expect(deepSeekHoverBackground).not.toBe(menuBackground)
})

test('mobile nav uses default vitepress screen and includes ask ai provider', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await page.locator('.VPNavBarHamburger').click()

  await expect(page.locator('.VPNavScreen')).toBeVisible()
  await expect(page.locator('.VPNavScreen .VPNavScreenMenu')).toBeVisible()
  await expect(page.locator('.VPNavScreen .kpo-mobile-sheet-handle')).toHaveCount(0)
  await expect(page.locator('.VPNavScreen .kpo-mobile-nav-tiles')).toHaveCount(0)
  await expect(page.locator('.VPNavScreen')).toContainText('Введение')
  await expect(page.locator('.VPNavScreen')).toContainText('Лекции')
  await expect(page.locator('.VPNavScreen')).toContainText('Дополнения')
  await expect(page.locator('.VPNavScreen')).toContainText('Заключение')

  const provider = page.locator('.VPNavScreen .KpoAskAiProviderScreen')
  await expect(provider).toBeVisible()
  await expect(provider).toContainText('СПРОСИТЬ ИИ')
  await expect(provider).toContainText('ChatGPT')
  await expect(provider).toContainText('Claude')
  await expect(provider).toContainText('DeepSeek')
  await expect(provider).toContainText('Копировать промпт')
  await expect(page.locator('.VPNavScreen .VPSwitchAppearance')).toBeVisible()
})

test('mobile ask ai provider changes and persists in default vitepress screen', async ({
  page
}) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await page.locator('.VPNavBarHamburger').click()
  const provider = page.locator('.VPNavScreen .KpoAskAiProviderScreen')
  await provider.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' }).click()

  await page.locator('.VPNavBarHamburger').click()
  await page.locator('.VPNavBarHamburger').click()
  const reopened = page.locator('.VPNavScreen .KpoAskAiProviderScreen')
  const claude = reopened.locator('.KpoAskAiProviderMenu__item', { hasText: 'Claude' })
  await expect(claude).toHaveAttribute('aria-checked', 'true')
  await expect(claude.locator('.KpoAskAiProviderMenu__check')).toBeVisible()
  await expect(reopened.locator('.KpoAskAiProviderMenu__item[aria-checked="true"]')).toHaveCount(1)
})

test('ask ai context menu appears for selected document text', async ({ page }) => {
  await resetComponentStorage(page)
  await stubUiServiceAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await selectTextAndOpenAskAiMenu(page, 'This page is intentionally hidden from navigation.')

  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
  await expect(page.locator('.kpo-ai-menu')).toContainText('Ask ChatGPT about this')
})

test('ask ai menu ignores programmatic viewport stabilization', async ({ page }) => {
  await setStorage(page, { 'kpo:playground-mode': '0' })
  await stubUiServiceAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForPageLayoutReady(page)
  await selectTextAndOpenAskAiMenu(page, 'This page is intentionally hidden from navigation.')

  await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'auto' }))

  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
})

test('ask ai menu closes on wheel scroll intent', async ({ page }) => {
  await setStorage(page, { 'kpo:playground-mode': '0' })
  await stubUiServiceAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForPageLayoutReady(page)
  await selectTextAndOpenAskAiMenu(page, 'This page is intentionally hidden from navigation.')

  await page.mouse.wheel(0, 120)

  await expect(page.locator('.kpo-ai-menu')).toHaveCount(0)
})

test('ask ai menu closes on touch and keyboard scroll intent', async ({ page }) => {
  await setStorage(page, { 'kpo:playground-mode': '0' })
  await stubUiServiceAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForPageLayoutReady(page)
  const selectedText = 'This page is intentionally hidden from navigation.'
  await selectTextAndOpenAskAiMenu(page, selectedText)

  await page.locator('.vp-doc').dispatchEvent('touchmove')
  await expect(page.locator('.kpo-ai-menu')).toHaveCount(0)

  await selectTextAndOpenAskAiMenu(page, selectedText)
  await page.keyboard.press('PageDown')
  await expect(page.locator('.kpo-ai-menu')).toHaveCount(0)
})

test('delayed Playground completion does not close an open ask ai menu', async ({ page }) => {
  await setStorage(page, { 'kpo:playground-mode': '1' })
  await stubUiServiceAskAiContext(page)
  let releasePlayground!: () => void
  const playgroundGate = new Promise<void>((resolve) => {
    releasePlayground = resolve
  })
  await page.route('**/*kotlin-playground*', async (route) => {
    await playgroundGate
    await route.fallback()
  })
  await page.goto(UI_FIXTURE_ROUTE)

  await selectTextAndOpenAskAiMenu(page, 'This page is intentionally hidden from navigation.')
  await expect(page.locator('.kpo-ai-menu')).toBeVisible()

  releasePlayground()
  await expect(page.locator('.kpo-playground').first()).toHaveClass(/kpo-playground--ready/)
  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
})

test('ask ai opens for content selections with browser boundary endpoints', async ({ page }) => {
  await resetComponentStorage(page)
  await stubSelectionBoundaryAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForAskAiBoundaryFixture(page)
  await mountAskAiBoundaryFixture(page)

  for (const scenario of [
    'terminal-inside',
    'terminal-after-content',
    'terminal-reverse',
    'before-content-to-first',
    'first-through-terminal',
    'terminal-through-footer',
    'nested-inline'
  ] satisfies SelectionBoundaryScenario[]) {
    await dispatchAskAiBoundarySelection(page, scenario)
    await expect(page.locator('.kpo-ai-menu'), scenario).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.kpo-ai-menu'), scenario).toHaveCount(0)
  }
})

test('ask ai ignores empty and non-content boundary selections', async ({ page }) => {
  await resetComponentStorage(page)
  await stubSelectionBoundaryAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForAskAiBoundaryFixture(page)
  await mountAskAiBoundaryFixture(page)

  for (const scenario of [
    'pager-only',
    'collapsed-terminal',
    'whitespace-only'
  ] satisfies SelectionBoundaryScenario[]) {
    await dispatchAskAiBoundarySelection(page, scenario)
    await expect(page.locator('.kpo-ai-menu'), scenario).toHaveCount(0)
  }
})

test('ask ai mobile bubble uses the clipped terminal paragraph rect', async ({ page }) => {
  await resetComponentStorage(page)
  await stubSelectionBoundaryAskAiContext(page)
  await page.setViewportSize(LAYOUT_VIEWPORTS.mobilePhone)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForAskAiBoundaryFixture(page)
  await mountAskAiBoundaryFixture(page)

  await dispatchAskAiBoundarySelection(page, 'terminal-after-content', { mobile: true })

  await expect(page.locator('.kpo-ai-menu')).toBeVisible()
})

test('ask ai prompt clips selection to vp-doc and excludes pager text', async ({ page }) => {
  await setStorage(page, { 'kpo:ask-ai-provider': 'clipboard' })
  await stubAskAiSideEffects(page)
  await stubSelectionBoundaryAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForAskAiBoundaryFixture(page)
  await mountAskAiBoundaryFixture(page)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  await dispatchAskAiBoundarySelection(page, 'terminal-through-footer')
  const menuItem = page.locator('.kpo-ai-menu__item')
  await expect(menuItem).toBeEnabled()
  await menuItem.click()

  let prompt = ''
  await expect
    .poll(async () => {
      prompt = await page.evaluate(() => {
        return (
          (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
        )
      })
      return prompt.length
    })
    .toBeGreaterThan(0)

  const selectedSection = prompt.split('[Выделенный фрагмент]\n')[1] ?? ''
  expect(selectedSection).toContain(SELECTION_TERMINAL_TEXT)
  expect(selectedSection).not.toContain('Pager')
  expect(selectedSection).not.toContain('Следующая')
  expect(selectedSection).not.toContain('Введение')
})

test('ask ai keeps intersected boundary blocks in document order', async ({ page }) => {
  await setStorage(page, { 'kpo:ask-ai-provider': 'clipboard' })
  await stubAskAiSideEffects(page)
  await stubSelectionBoundaryAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForAskAiBoundaryFixture(page)
  await mountAskAiBoundaryFixture(page)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  await dispatchAskAiBoundarySelection(page, 'first-through-terminal')
  const menuItem = page.locator('.kpo-ai-menu__item')
  await expect(menuItem).toBeEnabled()
  await menuItem.click()

  let prompt = ''
  await expect
    .poll(async () => {
      prompt = await page.evaluate(() => {
        return (
          (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
        )
      })
      return prompt.length
    })
    .toBeGreaterThan(0)

  const selectedSection = prompt.split('[Выделенный фрагмент]\n')[1] ?? ''
  const selectedTexts = [
    SELECTION_FIRST_TEXT,
    SELECTION_MIDDLE_TEXT,
    SELECTION_NESTED_TEXT,
    SELECTION_TERMINAL_TEXT
  ]
  const positions = selectedTexts.map((text) => selectedSection.indexOf(text))
  expect(
    positions.every((position) => position >= 0),
    selectedSection
  ).toBe(true)
  expect(positions).toEqual([...positions].sort((left, right) => left - right))
  expect(selectedSection).not.toContain('Pager')
})

test('ask ai boundary menu closes on route change', async ({ page }) => {
  await resetComponentStorage(page)
  await stubSelectionBoundaryAskAiContext(page)
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await waitForAskAiBoundaryFixture(page)
  await mountAskAiBoundaryFixture(page)
  await dispatchAskAiBoundarySelection(page, 'terminal-after-content')
  await expect(page.locator('.kpo-ai-menu')).toBeVisible()

  await page.goto(ASK_AI_FIXTURE_ROUTE)

  await expect(page.locator('.kpo-ai-menu')).toHaveCount(0)
})

test('ask ai waits for prompt preparation before first clipboard copy', async ({ page }) => {
  await resetComponentStorage(page)
  let releaseContext!: () => void
  const contextGate = new Promise<void>((resolve) => {
    releaseContext = resolve
  })

  await page.addInitScript(() => {
    ;(window as unknown as { __kpoAllowCopy: boolean }).__kpoAllowCopy = false
    ;(
      window as unknown as { __kpoCopyAttempts: Array<Record<string, unknown>> }
    ).__kpoCopyAttempts = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          const state = window as unknown as {
            __kpoAllowCopy: boolean
            __kpoCopyAttempts: Array<Record<string, unknown>>
          }
          state.__kpoCopyAttempts.push({
            method: 'clipboard-api',
            allowed: state.__kpoAllowCopy,
            active: navigator.userActivation?.isActive ?? false,
            focus: document.hasFocus(),
            length: text.length
          })
          if (!state.__kpoAllowCopy) {
            throw new DOMException('copy not allowed yet', 'NotAllowedError')
          }
        }
      }
    })
  })

  await page.route('**/__ask-ai-context/**', async (route) => {
    await contextGate
    await route.fallback()
  })

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')
  await selectTextAndOpenAskAiMenu(page, 'This page is intentionally hidden from navigation.')

  const menuItem = page.locator('.kpo-ai-menu__item')
  await expect(menuItem).toBeDisabled()
  await expect(menuItem).toHaveText('Preparing prompt...')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  await page.evaluate(() => {
    ;(window as unknown as { __kpoAllowCopy: boolean }).__kpoAllowCopy = true
  })
  releaseContext()
  await expect(menuItem).toBeEnabled()
  await menuItem.click()

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  const attempts = await page.evaluate(() => {
    return (window as unknown as { __kpoCopyAttempts: Array<Record<string, unknown>> })
      .__kpoCopyAttempts
  })
  expect(attempts).toHaveLength(1)
  expect(attempts[0]).toMatchObject({
    method: 'clipboard-api',
    allowed: true,
    focus: true
  })
})

test('ask ai starts clipboard copy before opening provider tab', async ({ page }) => {
  await resetComponentStorage(page)
  await page.addInitScript(() => {
    ;(window as unknown as { __kpoSideEffectOrder: string[] }).__kpoSideEffectOrder = []
    ;(window as unknown as { __kpoOpenedUrls: string[] }).__kpoOpenedUrls = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          ;(window as unknown as { __kpoSideEffectOrder: string[] }).__kpoSideEffectOrder.push(
            'copy'
          )
        }
      }
    })

    window.open = ((url?: string | URL) => {
      const state = window as unknown as {
        __kpoSideEffectOrder: string[]
        __kpoOpenedUrls: string[]
      }
      state.__kpoSideEffectOrder.push('open')
      if (url) state.__kpoOpenedUrls.push(String(url))

      const fakeLocation = {}
      Object.defineProperty(fakeLocation, 'href', {
        set(value: string) {
          state.__kpoSideEffectOrder.push('navigate')
          state.__kpoOpenedUrls.push(String(value))
        },
        get() {
          return ''
        }
      })

      return {
        opener: null,
        close: () => undefined,
        location: fakeLocation
      } as Window
    }) as typeof window.open
  })

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'Claude')
  await selectTextAndClickAskAiMenuItem(page, 'This page is intentionally hidden from navigation.')

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied, opened Claude')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  const result = await page.evaluate(() => {
    const state = window as unknown as {
      __kpoSideEffectOrder: string[]
      __kpoOpenedUrls: string[]
    }
    return {
      order: state.__kpoSideEffectOrder,
      openedUrls: state.__kpoOpenedUrls
    }
  })
  expect(result.order.slice(0, 2)).toEqual(['copy', 'open'])
  expect(result.openedUrls).toContain('https://claude.ai/new')
})

test('ask ai manual prompt appears only after clipboard methods fail', async ({ page }) => {
  await resetComponentStorage(page)
  await stubClipboardFailure(page)

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')
  await selectTextAndClickAskAiMenuItem(page, 'This page is intentionally hidden from navigation.')

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Copy prompt manually')
  await expect(page.locator('.kpo-ai-manual')).toBeVisible()
  const manualTextarea = page.locator('.kpo-ai-manual textarea')
  const manualClose = page.locator('.kpo-ai-manual button')
  await expect(manualTextarea).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(manualClose).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(manualTextarea).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(manualClose).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)
  await expect(page.locator('.KpoAskAiProvider > button')).toBeFocused()

  const attempts = await page.evaluate(() => {
    return (window as unknown as { __kpoCopyAttempts: string[] }).__kpoCopyAttempts
  })
  expect(attempts).toEqual(['clipboard-api', 'textarea-copy'])
})

test('ask ai manual prompt restores focus to the visible responsive provider control', async ({
  page
}) => {
  await setStorage(page, { 'kpo:ask-ai-provider': 'clipboard' })
  await stubClipboardFailure(page)

  for (const scenario of [
    { viewport: { width: 800, height: 900 }, selector: '.KpoNavBarExtra > button' },
    { viewport: { width: 390, height: 844 }, selector: '.VPNavBarHamburger' }
  ]) {
    await page.setViewportSize(scenario.viewport)
    await page.goto(ASK_AI_FIXTURE_ROUTE)
    await selectTextAndClickAskAiMenuItem(
      page,
      'This page is intentionally hidden from navigation.'
    )
    await expect(page.locator('.kpo-ai-manual')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)
    await expect(page.locator(scenario.selector)).toBeFocused()
  }
})

test('ask ai copies full page context without duplicating VitePress base', async ({ page }) => {
  await resetComponentStorage(page)
  const contextPaths: string[] = []

  await stubAskAiSideEffects(page)

  await page.route('**/__ask-ai-context/**', async (route) => {
    contextPaths.push(new URL(route.request().url()).pathname)
    await route.fallback()
  })

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  const selectedText = 'This page is intentionally hidden from navigation.'
  await selectTextAndClickAskAiMenuItem(page, selectedText)

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied')
  expect(contextPaths).toContain('/KPO/__ask-ai-context/service-pages/ask-ai-contract.json')
  expect(contextPaths).not.toContain('/KPO/__ask-ai-context/KPO/service-pages/ask-ai-contract.json')

  const copiedPrompt = await page.evaluate(() => {
    return (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
  })

  expect(copiedPrompt).toContain('[Контекст до]\nStable context before')
  expect(copiedPrompt).toContain('[Контекст после]\n[Code: text]\n```text')
  expect(copiedPrompt).toContain('fixture context after selection')
  expect(copiedPrompt).toContain(`[Выделенный фрагмент]\n${selectedText}`)
})

test('ask ai keeps clipboard fallback when page context is unavailable', async ({ page }) => {
  await resetComponentStorage(page)

  await stubAskAiSideEffects(page)
  let unavailableContextResponses = 0

  await page.route('**/__ask-ai-context/**', async (route) => {
    unavailableContextResponses += 1
    await route.fulfill({ status: 204 })
  })

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'Копировать промпт')

  const selectedText = 'This page is intentionally hidden from navigation.'
  await openAskAiMenuWhenReady(page, selectedText, { activate: true })

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied without page context')
  expect(unavailableContextResponses).toBeGreaterThan(0)

  const copiedPrompt = await page.evaluate(() => {
    return (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? ''
  })

  expect(copiedPrompt).toContain(`[Текущий блок]\n${selectedText}`)
  expect(copiedPrompt).toContain(`[Выделенный фрагмент]\n${selectedText}`)
})

test('ask ai copies prompt and opens base ChatGPT without query parameter', async ({ page }) => {
  await resetComponentStorage(page)
  await stubAskAiSideEffects(page)

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'ChatGPT')

  const selectedText = 'This page is intentionally hidden from navigation.'
  await selectTextAndClickAskAiMenuItem(page, selectedText)

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied, opened ChatGPT')

  const result = await page.evaluate(() => {
    return {
      prompt:
        (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? '',
      openedUrls: (window as unknown as { __kpoOpenedUrls?: string[] }).__kpoOpenedUrls ?? []
    }
  })

  expect(result.openedUrls).toContain('https://chatgpt.com/')
  expect(result.openedUrls.some((url) => url.startsWith('https://chatgpt.com/?q='))).toBe(false)
  expect(result.prompt).toContain('fixture context after selection')
  expect(result.prompt).toContain(selectedText)
})

test('ask ai copies and opens Claude without showing manual prompt', async ({ page }) => {
  await resetComponentStorage(page)
  await stubAskAiSideEffects(page)

  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await selectAskAiProviderDesktop(page, 'Claude')

  await selectTextAndClickAskAiMenuItem(page, 'This page is intentionally hidden from navigation.')

  await expect(page.locator('.kpo-ai-toast')).toHaveText('Prompt copied, opened Claude')
  await expect(page.locator('.kpo-ai-manual')).toHaveCount(0)

  const result = await page.evaluate(() => {
    return {
      prompt:
        (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts?.at(-1) ?? '',
      openedUrls: (window as unknown as { __kpoOpenedUrls?: string[] }).__kpoOpenedUrls ?? []
    }
  })

  expect(result.prompt).toContain('This page is intentionally hidden from navigation.')
  expect(result.openedUrls).toContain('https://claude.ai/new')
})

test('ask ai mobile bubble appears after text selection', async ({ page }) => {
  await resetComponentStorage(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(ASK_AI_FIXTURE_ROUTE)
  await page.locator('.KpoAskAiProvider').waitFor({ state: 'attached' })
  await waitForPageLayoutReady(page)

  await page
    .locator('.vp-doc p')
    .first()
    .evaluate((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })

  const mobileMenu = page.locator('.kpo-ai-menu--mobile')
  await expect(mobileMenu).toBeVisible()
  await expect(mobileMenu).toContainText('Ask AI')
})
