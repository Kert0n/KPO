import { expect, test as base } from '@playwright/test'
import { stubUiServiceAskAiContext } from '../helpers/serviceFixtures'

const componentStorageBaseline = {
  'kpo:playground-mode': '0',
  'kpo:code-language': 'kotlin',
  'kpo:ask-ai-provider': 'chatgpt'
} as const

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript((baseline) => {
      for (const [key, value] of Object.entries(baseline)) {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
      }
    }, componentStorageBaseline)
    await stubUiServiceAskAiContext(page)

    const pageErrors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await use(page)

    expect(pageErrors, 'unexpected page errors').toEqual([])
    expect(consoleErrors, 'unexpected browser console errors').toEqual([])
  }
})

export { expect }
