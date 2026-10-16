import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import {
  UI_FIXTURE_ROUTE,
  openAskAiMenuWhenReady,
  resetComponentStorage,
  stubAskAiSideEffects
} from './helpers/kpoTestSupport'

const FIXTURE_TEXT = 'This page is intentionally hidden from navigation.'
const FIXTURE_SOURCE = 'content/service-pages/ui-contract/vitepress.md'
const ANNOUNCEMENT_KEY = 'kpo:suggest-edit-announcement-seen'
const DURING_ANNOUNCEMENT = new Date('2026-10-20T12:00:00')
const AFTER_ANNOUNCEMENT = new Date('2026-11-02T12:00:00')

async function openedUrls(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __kpoOpenedUrls?: string[] }).__kpoOpenedUrls ?? []
  )
}

async function showAnnouncement(page: Page, now: Date): Promise<void> {
  await page.clock.setFixedTime(now)
  // Базовое хранилище тестов помечает анонс просмотренным; здесь он нужен.
  // Сбрасываем один раз на вкладку, чтобы проверить, что закрытие переживает перезагрузку.
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('kpo-test:announcement-reset')) return
    sessionStorage.setItem('kpo-test:announcement-reset', '1')
    localStorage.removeItem(key)
  }, ANNOUNCEMENT_KEY)
}

test('selection menu offers a GitHub fix that copies a searchable fragment', async ({ page }) => {
  await resetComponentStorage(page)
  await stubAskAiSideEffects(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(UI_FIXTURE_ROUTE)

  await openAskAiMenuWhenReady(page, FIXTURE_TEXT)
  const menu = page.locator('.kpo-ai-menu')
  await expect(menu.locator('.kpo-ai-menu__item')).toHaveCount(1)
  await expect(menu.locator('[data-kpo-suggest]')).toHaveText([
    'Исправить фрагмент',
    'Сообщить об ошибке'
  ])

  await menu.locator('[data-kpo-suggest="fix"]').click()
  await expect(menu).toHaveCount(0)
  await expect
    .poll(() => openedUrls(page))
    .toContain(`https://github.com/Kert0n/KPO/edit/master/${FIXTURE_SOURCE}`)
  const copied = await page.evaluate(
    () => (window as unknown as { __kpoCopiedPrompts?: string[] }).__kpoCopiedPrompts ?? []
  )
  expect(copied).toEqual([FIXTURE_TEXT])
  await expect(page.locator('.kpo-ai-toast')).toContainText('Ctrl+F')
})

test('selection menu reports a problem with the quote and source lines', async ({ page }) => {
  await resetComponentStorage(page)
  await stubAskAiSideEffects(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(UI_FIXTURE_ROUTE)

  await openAskAiMenuWhenReady(page, FIXTURE_TEXT)
  await page.locator('.kpo-ai-menu [data-kpo-suggest="report"]').click()

  await expect
    .poll(async () => (await openedUrls(page)).find((url) => url.includes('/issues/new')))
    .toBeTruthy()
  const issueUrl = (await openedUrls(page)).find((url) => url.includes('/issues/new'))!
  const params = new URL(issueUrl).searchParams
  expect(params.get('template')).toBe('content-error.md')
  expect(params.get('title')).toBe(`UI Contract Fixtures: «${FIXTURE_TEXT}»`)
  const body = params.get('body') ?? ''
  expect(body).toContain(`> ${FIXTURE_TEXT}`)
  expect(body).toContain(`${FIXTURE_SOURCE}#L12-L13`)
  expect(body).toContain('/service-pages/ui-contract')
})

test('announcement teaches the selection gesture and stays dismissed', async ({ page }) => {
  await showAnnouncement(page, DURING_ANNOUNCEMENT)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(UI_FIXTURE_ROUTE)

  const coach = page.locator('.KpoHelpCourse__coach')
  await expect(coach).toBeVisible()
  await expect(page.locator('.KpoHelpCourse__link')).toHaveClass(/--highlight/)

  await coach.getByRole('button', { name: 'Показать как' }).click()
  await expect(coach).toHaveCount(0)
  const menu = page.locator('.kpo-ai-menu--tour')
  await expect(menu).toBeVisible()
  await expect(menu).toContainText('правой кнопкой мыши')
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).not.toBe('')
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), ANNOUNCEMENT_KEY))
    .toBe('1')

  await menu.getByRole('button', { name: 'Понятно' }).click()
  await expect(page.locator('.kpo-ai-menu')).toHaveCount(0)
})

test('announcement disappears for good after its end date', async ({ page }) => {
  await showAnnouncement(page, AFTER_ANNOUNCEMENT)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(UI_FIXTURE_ROUTE)

  await expect(page.locator('.KpoHelpCourse__link')).toBeVisible()
  await expect(page.locator('.KpoSuggestEditHint')).toBeVisible()
  await expect(page.locator('.KpoHelpCourse__coach')).toHaveCount(0)
})

test('mobile announcement is a bottom card and the hint names the touch gesture', async ({
  page
}) => {
  await showAnnouncement(page, DURING_ANNOUNCEMENT)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(UI_FIXTURE_ROUTE)

  const coach = page.locator('.KpoHelpCourse__coach')
  await expect(coach).toBeVisible()
  const box = await coach.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  expect(box!.y + box!.height).toBeLessThanOrEqual(812)

  await coach.getByRole('button', { name: 'Понятно' }).click()
  await expect(coach).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.KpoHelpCourse__coach')).toHaveCount(0)

  const hint = page.locator('.KpoSuggestEditHint')
  await expect(hint.locator('.KpoSuggestEditHint__gesture--touch')).toBeVisible()
  await expect(hint.locator('.KpoSuggestEditHint__gesture--pointer')).toBeHidden()
})
