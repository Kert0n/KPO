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
