import { expect, test as baseTest, type Page } from '@playwright/test'

const ALLOWED_WARNINGS = [
  /^\[ask-ai] не удалось (?:выполнить Ask AI|подготовить prompt):/,
  /^\[kotlin-playground] инициализация не удалась:/,
  /^\[mermaid] не удалось отрисовать диаграмму:/
]

const messages = new WeakMap<Page, string[]>()

export function registerConsoleGuard(test: typeof baseTest): void {
  test.beforeEach(async ({ page }) => {
    const unexpected: string[] = []
    messages.set(page, unexpected)
    page.on('console', (message) => {
      if (message.type() !== 'warning' && message.type() !== 'error') return
      const text = message.text()
      if (message.type() === 'warning' && ALLOWED_WARNINGS.some((pattern) => pattern.test(text))) return
      const location = message.location().url
      unexpected.push(`${message.type()}: ${text}${location ? ` (${location})` : ''}`)
    })
    page.on('pageerror', (error) => unexpected.push(`pageerror: ${error.message}`))
  })

  test.afterEach(async ({ page }) => {
    expect(messages.get(page) ?? [], 'Unexpected browser console output').toEqual([])
  })
}
