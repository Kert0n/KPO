import type { Page } from '@playwright/test'

export const UI_SERVICE_ASK_AI_CONTEXT_ROUTE = '**/__ask-ai-context/service-pages/*.json'

export async function stubUiServiceAskAiContext(page: Page): Promise<void> {
  await page.route(UI_SERVICE_ASK_AI_CONTEXT_ROUTE, async (route) => {
    const askAiFixture = route.request().url().includes('/ask-ai-contract.json')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        courseTitle: 'Конструирование ПО',
        courseDescription: 'Конспект лекций по архитектуре приложений и инженерным практикам',
        pageTitle: askAiFixture ? 'Ask AI Contract Fixture' : 'UI Contract Fixtures',
        pageDescription: '',
        sourcePath: askAiFixture
          ? 'service-pages/ask-ai-contract.md'
          : 'service-pages/ui-contract.md',
        blocks: [
          {
            id: 'fixture-context-before',
            kind: 'paragraph',
            markdown: 'Stable context before the selected fixture paragraph.',
            plainText: 'Stable context before the selected fixture paragraph.',
            lineStart: 1,
            lineEnd: 1
          },
          {
            id: askAiFixture ? 'kpo-ai-4-paragraph-14n0dzi' : 'kpo-ai-4-paragraph-1o4j04g',
            kind: 'paragraph',
            markdown: 'This page is intentionally hidden from navigation.',
            plainText: 'This page is intentionally hidden from navigation.',
            lineStart: 2,
            lineEnd: 2
          },
          {
            id: 'fixture-context-after',
            kind: 'code',
            markdown: '```text\nfixture context after selection\n```',
            plainText: 'fixture context after selection',
            lineStart: 3,
            lineEnd: 5,
            language: 'text'
          }
        ]
      })
    })
  })
}

/**
 * Keeps characterization on the successful service-fixture path without
 * changing the published golden-master prompt, which historically has no
 * generated context for this non-public page.
 */
export async function stubEmptyUiServiceAskAiContext(page: Page): Promise<void> {
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

export async function stubSelectionBoundaryAskAiContext(page: Page): Promise<void> {
  await page.route(UI_SERVICE_ASK_AI_CONTEXT_ROUTE, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        courseTitle: 'Конструирование ПО',
        courseDescription: 'Конспект лекций по архитектуре приложений и инженерным практикам',
        pageTitle: 'Selection Boundary Contract',
        pageDescription: '',
        sourcePath: 'tests/fixtures/selection-boundary',
        blocks: [
          boundaryBlock('selection-first', 'paragraph', 1, 1, FIRST_BOUNDARY_TEXT),
          boundaryBlock('selection-middle', 'paragraph', 2, 2, MIDDLE_BOUNDARY_TEXT),
          boundaryBlock(
            'selection-nested',
            'paragraph',
            3,
            3,
            'Nested boundary phrase combines **bold boundary text** and `inline boundary code` inside one paragraph.',
            NESTED_BOUNDARY_TEXT
          ),
          boundaryBlock('selection-terminal', 'paragraph', 4, 4, TERMINAL_BOUNDARY_TEXT)
        ]
      })
    })
  })
}

const FIRST_BOUNDARY_TEXT =
  'First boundary paragraph starts inside the learning content and must survive a range that begins before the document.'
const MIDDLE_BOUNDARY_TEXT =
  'Middle boundary paragraph keeps enough ordinary text between the first and terminal paragraphs for block ordering checks.'
const NESTED_BOUNDARY_TEXT =
  'Nested boundary phrase combines bold boundary text and inline boundary code inside one paragraph.'
const TERMINAL_BOUNDARY_TEXT =
  'Terminal boundary paragraph belongs only to the learning content and must open Ask AI when selected fully.'

function boundaryBlock(
  id: string,
  kind: string,
  lineStart: number,
  lineEnd: number,
  markdown: string,
  plainText = markdown
) {
  return {
    id,
    kind,
    markdown,
    plainText,
    lineStart,
    lineEnd
  }
}
