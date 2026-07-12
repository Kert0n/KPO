import type { Page } from '@playwright/test'

export const UI_SERVICE_ASK_AI_CONTEXT_ROUTE = '**/__ask-ai-context/service-pages/ui-contract.json'

export async function stubUiServiceAskAiContext(page: Page): Promise<void> {
  await page.route(UI_SERVICE_ASK_AI_CONTEXT_ROUTE, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        courseTitle: 'Конструирование ПО',
        courseDescription: 'Конспект лекций по архитектуре приложений и инженерным практикам',
        pageTitle: 'UI Contract Fixtures',
        pageDescription: '',
        sourcePath: 'service-pages/ui-contract.md',
        blocks: []
      })
    })
  })
}
