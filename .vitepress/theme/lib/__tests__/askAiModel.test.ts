import { describe, expect, it } from 'vitest'
import {
  askAiContextUrlForRoute,
  buildAskAiPrompt,
  AskAiPromptTooLongError,
  collectAfterContextBlocks,
  collectBeforeContextBlocks,
  resolveAskAiProviderAction,
  routePathToAskAiContextKey,
  type AskAiPageContext
} from '../askAiModel'

const context: AskAiPageContext = {
  courseTitle: 'КПО',
  courseDescription: 'Курс',
  pageTitle: 'Лекция',
  pageDescription: 'Описание',
  sourcePath: 'content/service-pages/model-fixture/vitepress.md',
  blocks: [
    block('before', 'paragraph', 'before '.repeat(400)),
    block('current', 'code', 'current '.repeat(400), 'kotlin'),
    block('after', 'paragraph', 'after '.repeat(400))
  ]
}

describe('askAiModel', () => {
  it('trims element content without removing context or changing the selection', () => {
    const selectedText = 'important selection '.repeat(40).trim()
    const prompt = buildAskAiPrompt({
      pageContext: context,
      selectedText,
      blockIds: ['current'],
      maxChars: 2400
    })

    expect(prompt.length).toBeLessThanOrEqual(2400)
    expect(prompt).toContain('Ты помогаешь студенту')
    expect(prompt).toContain('[Выделенный фрагмент]')
    expect(prompt.split('[Выделенный фрагмент]\n')[1]).toBe(selectedText)
    expect(prompt).not.toContain('[Контекст до]\n(нет)')
    expect(prompt).not.toContain('[Контекст после]\n(нет)')
    expect(prompt).toContain('[... фрагмент сокращен ...]')
  })

  it('projects the selected multi-code language without changing neighboring elements', () => {
    const pageContext: AskAiPageContext = {
      ...context,
      blocks: [
        block('before-table', 'table', '| Key | Value |\n| --- | --- |\n| fixture | before |'),
        block(
          'current',
          'multi-code',
          '::: multi-code\n```kotlin\nval visible = true\n```\n```java\nvar hidden = true;\n```\n:::'
        ),
        block('after-mermaid', 'mermaid', '```mermaid\nflowchart LR\nA --> B\n```')
      ]
    }
    const prompt = buildAskAiPrompt({
      pageContext,
      selectedText: 'val visible = true',
      blockIds: ['current'],
      currentOverride: {
        kind: 'code',
        language: 'kotlin',
        markdown: '```kotlin\nval visible = true\n```'
      },
      maxChars: 12000
    })

    expect(prompt).toContain('| fixture | before |')
    expect(prompt).toContain('[Mermaid source]\n```mermaid')
    expect(prompt).toContain('[Текущий блок]\n[Code: kotlin]')
    expect(prompt).not.toContain('var hidden = true')
  })

  it('rejects an oversized selection instead of silently truncating it', () => {
    expect(() =>
      buildAskAiPrompt({
        pageContext: context,
        selectedText: 'selected-exact '.repeat(1000),
        blockIds: ['current'],
        maxChars: 12000
      })
    ).toThrow(AskAiPromptTooLongError)
  })

  it('copies prompt and opens base ChatGPT without query parameter', () => {
    const action = resolveAskAiProviderAction('chatgpt', {
      pageContext: context,
      selectedText: 'short',
      blockIds: ['current']
    })

    expect(action.copyPrompt).toBe(true)
    expect(action.openUrl).toBe('https://chatgpt.com/')
    expect(action.toastKind).toBe('copied-and-opened')
  })

  it('always copies before opening Claude and DeepSeek', () => {
    const claudeAction = resolveAskAiProviderAction('claude', {
      pageContext: context,
      selectedText: 'short',
      blockIds: ['current']
    })
    const deepSeekAction = resolveAskAiProviderAction('deepseek', {
      pageContext: context,
      selectedText: 'short',
      blockIds: ['current']
    })

    expect(claudeAction.copyPrompt).toBe(true)
    expect(claudeAction.openUrl).toBe('https://claude.ai/new')

    expect(claudeAction.toastKind).toBe('copied-and-opened')

    expect(deepSeekAction.copyPrompt).toBe(true)
    expect(deepSeekAction.openUrl).toBe('https://chat.deepseek.com/')

    expect(deepSeekAction.toastKind).toBe('copied-and-opened')
  })

  it('includes bridge text plus the next substantive block in after context', () => {
    const prompt = buildAskAiPrompt({
      pageContext: reportContext,
      selectedText: '/api/v1/reports/jobs/{jobId}',
      blockIds: ['report-table'],
      maxChars: 12000
    })

    expect(prompt).toContain('[Контекст после]\nОтвет на запуск может выглядеть так:')
    expect(prompt).toContain('HTTP/1.1 202 Accepted')
    expect(prompt).toContain('Location: /api/v1/reports/jobs/job-7')
  })

  it('includes previous substantive context behind a before bridge', () => {
    const pageContext: AskAiPageContext = {
      ...context,
      blocks: [
        block('previous-code', 'code', 'val retryPolicy = RetryPolicy(maxAttempts = 3)', 'kotlin'),
        block('bridge', 'paragraph', 'Пример:'),
        block('current', 'paragraph', 'Клиент повторяет запрос после timeout.')
      ]
    }
    const prompt = buildAskAiPrompt({
      pageContext,
      selectedText: 'timeout',
      blockIds: ['current'],
      maxChars: 12000
    })

    expect(prompt).toContain('val retryPolicy = RetryPolicy(maxAttempts = 3)')
    expect(prompt).toContain('Пример:')
  })

  it('stops after context at a new heading after useful context is found', () => {
    const blocks = [
      block('current', 'paragraph', 'Текущий блок.'),
      block('useful', 'paragraph', 'Полезный контекст после текущего блока '.repeat(8)),
      block('next-heading', 'heading', '## Следующая тема'),
      block('unrelated', 'paragraph', 'Несвязанный блок следующей секции')
    ]

    expect(collectAfterContextBlocks(blocks, 0, 1800).map((item) => item.id)).toEqual(['useful'])
  })

  it('collects before bridges and substantive blocks in natural order', () => {
    const blocks = [
      block('useful', 'mermaid', 'flowchart TD\n  A --> B'),
      block('bridge', 'paragraph', 'Например:'),
      block('current', 'paragraph', 'Текущий блок.')
    ]

    expect(collectBeforeContextBlocks(blocks, 2, 1800).map((item) => item.id)).toEqual([
      'useful',
      'bridge'
    ])
  })

  it('normalizes VitePress routes to lazy context keys', () => {
    expect(routePathToAskAiContextKey('/lectures/01')).toBe('lectures/01')
    expect(routePathToAskAiContextKey('/extras/')).toBe('extras/index')
    expect(routePathToAskAiContextKey('/')).toBe('index')
    expect(routePathToAskAiContextKey('/KPO/lectures/10', '/KPO/')).toBe('lectures/10')
    expect(routePathToAskAiContextKey('/KPO/extras/', '/KPO/')).toBe('extras/index')
    expect(routePathToAskAiContextKey('/KPO/', '/KPO/')).toBe('index')
    expect(routePathToAskAiContextKey('/lectures/10', '/KPO/')).toBe('lectures/10')
    expect(routePathToAskAiContextKey('/KPO/lectures/10#rest', '/KPO/')).toBe('lectures/10')
    expect(routePathToAskAiContextKey('/KPO/lectures/10?x=1', '/KPO/')).toBe('lectures/10')
  })

  it('builds context URLs without duplicating VitePress base', () => {
    const withBaseStub = (path: string) => `/KPO${path}`
    const url = askAiContextUrlForRoute('/KPO/lectures/10', '/KPO/', withBaseStub)

    expect(url).toBe('/KPO/__ask-ai-context/lectures/10.json')
    expect(url).not.toContain('/__ask-ai-context/KPO/')
  })
})

const reportContext: AskAiPageContext = {
  courseTitle: 'Конструирование ПО',
  courseDescription: 'Курс',
  pageTitle: 'Report fixture',
  pageDescription: '',
  sourcePath: 'content/service-pages/report-fixture/vitepress.md',
  blocks: [
    block(
      'report-table',
      'table',
      '| Шаг | Endpoint | Метод | Успешный статус | Смысл |\n|-----|----------|-------|-----------------|-------|\n| Запустить отчет | `/api/v1/reports` | `POST` | `202` | задача принята |\n| Проверить задачу | `/api/v1/reports/jobs/{jobId}` | `GET` | `200` | текущий статус |\n| Скачать отчет | `/api/v1/reports/{reportId}` | `GET` | `200` | готовый результат |\n| Отменить задачу | `/api/v1/reports/jobs/{jobId}` | `DELETE` | `204` | отмена, если еще можно |'
    ),
    block('report-bridge', 'paragraph', 'Ответ на запуск может выглядеть так:'),
    block(
      'report-response',
      'code',
      'HTTP/1.1 202 Accepted\nLocation: /api/v1/reports/jobs/job-7\nContent-Type: application/json\n\n{\n  "jobId": "job-7",\n  "status": "pending"\n}',
      'http'
    )
  ]
}

function block(
  id: string,
  kind: AskAiPageContext['blocks'][number]['kind'],
  markdown: string,
  language?: string
): AskAiPageContext['blocks'][number] {
  return {
    id,
    kind,
    markdown,
    language,
    plainText: markdown,
    lineStart: 1,
    lineEnd: 1
  }
}
