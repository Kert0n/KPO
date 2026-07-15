import { describe, expect, it } from 'vitest'
import {
  collectAdditionalReadings,
  extractAdditionalReadingsSection,
  parseAdditionalReadingsSection,
  parseContentAdditionalReadings
} from '../additionalReadings'
import type { ContentPage, ContentPageKind } from '../contentTypes'

const canonicalSection = `## Дополнительное чтение

### Практика

- [Материал](https://example.com/article) — пояснение`

describe('additional readings sections', () => {
  it('extracts the canonical H2 until the next H2', () => {
    const section = extractAdditionalReadingsSection(`# Материал

${canonicalSection}

## Следующий раздел

Текст.`)

    expect(section).toContain('### Практика')
    expect(section).toContain('[Материал](https://example.com/article)')
    expect(section).not.toContain('Следующий раздел')
  })

  it('recognizes the compatible further-reading heading case-insensitively', () => {
    const page = contentPage({ kind: 'lecture', order: 14, title: 'Наблюдаемость' })
    const reading = parseContentAdditionalReadings(
      page,
      `##   ИСТОЧНИКИ   ДЛЯ ДАЛЬНЕЙШЕГО ЧТЕНИЯ

- [Книга](https://example.com/book)`
    )

    expect(reading?.groups).toEqual([
      {
        title: 'Материалы',
        items: [{ title: 'Книга', url: 'https://example.com/book' }]
      }
    ])
  })

  it('ignores similar headings and headings inside code fences', () => {
    const source = `## Дополнительное чтение и практика

\`\`\`md
## Дополнительное чтение
- [Скрытая ссылка](https://example.com/hidden)
\`\`\``

    expect(extractAdditionalReadingsSection(source)).toBeNull()
  })

  it('parses named groups and normalizes same-line and continued notes', () => {
    expect(
      parseAdditionalReadingsSection(`Вводный абзац игнорируется.

### Теория

- [Без заметки](https://example.com/a)
- [С заметкой](https://example.com/b) — первая строка
  и продолжение заметки

### Видео

- [Доклад](https://example.com/video) - пояснение`)
    ).toEqual([
      {
        title: 'Теория',
        items: [
          { title: 'Без заметки', url: 'https://example.com/a' },
          {
            title: 'С заметкой',
            url: 'https://example.com/b',
            note: 'первая строка и продолжение заметки'
          }
        ]
      },
      {
        title: 'Видео',
        items: [{ title: 'Доклад', url: 'https://example.com/video', note: 'пояснение' }]
      }
    ])
  })

  it('uses the default group when the section has no H3', () => {
    expect(parseAdditionalReadingsSection('- [Статья](https://example.com)')).toEqual([
      {
        title: 'Материалы',
        items: [{ title: 'Статья', url: 'https://example.com' }]
      }
    ])
  })

  it('does not turn prose or fenced-code links into reading items', () => {
    expect(
      parseAdditionalReadingsSection(`Обычная [ссылка](https://example.com/prose) во вводном тексте.

\`\`\`md
- [Ссылка в коде](https://example.com/code)
\`\`\`

- [Настоящий источник](https://example.com/reading)`)
    ).toEqual([
      {
        title: 'Материалы',
        items: [{ title: 'Настоящий источник', url: 'https://example.com/reading' }]
      }
    ])
  })
})

describe('catalog-driven additional readings', () => {
  it('takes all source metadata from the catalog, independent of the directory name', () => {
    const page = contentPage({
      kind: 'lecture',
      order: 27,
      title: 'Название из каталога',
      route: '/fixtures/custom-route',
      sourcePath: 'fixtures/arbitrary-directory/source.md'
    })

    expect(parseContentAdditionalReadings(page, canonicalSection)).toMatchObject({
      sourceKind: 'lecture',
      order: 27,
      title: 'Название из каталога',
      route: '/fixtures/custom-route',
      anchor: 'lecture-27'
    })
  })

  it('automatically collects future lectures and extras and sorts by kind, order, route', () => {
    const pages = [
      contentPage({ kind: 'extra', order: 4, route: '/fixtures/extra-b' }),
      contentPage({ kind: 'lecture', order: 20, route: '/fixtures/lecture-b' }),
      contentPage({ kind: 'extra', order: 2, route: '/fixtures/extra-a' }),
      contentPage({ kind: 'lecture', order: 3, route: '/fixtures/lecture-a' })
    ]

    expect(
      collectAdditionalReadings(pages, () => canonicalSection).map((item) => item.route)
    ).toEqual([
      '/fixtures/lecture-a',
      '/fixtures/lecture-b',
      '/fixtures/extra-a',
      '/fixtures/extra-b'
    ])
  })

  it('skips pages without a reading section and non-content source kinds', () => {
    const pages = [
      contentPage({ kind: 'lecture', order: 1, route: '/fixtures/no-section' }),
      contentPage({ kind: 'service', order: 2, route: '/fixtures/service' }),
      contentPage({ kind: 'home', order: 3, route: '/fixtures/home' }),
      contentPage({ kind: 'extras-index', order: 4, route: '/fixtures/index' }),
      contentPage({ kind: 'intro', order: 5, route: '/fixtures/intro' }),
      contentPage({ kind: 'conclusion', order: 6, route: '/fixtures/conclusion' })
    ]

    expect(collectAdditionalReadings(pages, () => '# Обычная страница')).toEqual([])
  })
})

describe('additional readings diagnostics', () => {
  it.each([
    ['empty section', '## Дополнительное чтение\n\nВводный текст.', 'has no valid items'],
    [
      'empty group',
      `## Дополнительное чтение

### Пустая группа

Текст.

### Заполненная группа

- [Материал](https://example.com)`,
      'group "Пустая группа" has no items'
    ],
    [
      'malformed link',
      '## Дополнительное чтение\n\n- [Незакрытая ссылка](https://example.com',
      'must start with a Markdown link'
    ],
    [
      'unsupported protocol',
      '## Дополнительное чтение\n\n- [Архив](ftp://example.com/archive)',
      'URL must use http or https'
    ]
  ])('reports source path and line for %s', (_, source, message) => {
    const page = contentPage({ sourcePath: 'fixtures/invalid.md' })

    expect(() => parseContentAdditionalReadings(page, source)).toThrow(
      new RegExp(`fixtures/invalid\\.md:\\d+:.*${escapeRegExp(message)}`)
    )
  })

  it('rejects duplicate recognized sections', () => {
    const page = contentPage({ sourcePath: 'fixtures/duplicate-section.md' })

    expect(() =>
      parseContentAdditionalReadings(
        page,
        `${canonicalSection}\n\n## Источники для дальнейшего чтения\n\n- [Ещё](https://example.com/next)`
      )
    ).toThrow('fixtures/duplicate-section.md:7: duplicate additional readings section')
  })

  it('rejects duplicate generated anchors', () => {
    const pages = [
      contentPage({ kind: 'extra', order: 8, route: '/fixtures/first' }),
      contentPage({ kind: 'extra', order: 8, route: '/fixtures/second' })
    ]

    expect(() => collectAdditionalReadings(pages, () => canonicalSection)).toThrow(
      'duplicate additional readings anchor: article-8'
    )
  })

  it('rejects duplicate source routes', () => {
    const pages = [
      contentPage({ kind: 'lecture', order: 1, route: '/fixtures/shared-route' }),
      contentPage({ kind: 'extra', order: 2, route: '/fixtures/shared-route' })
    ]

    expect(() => collectAdditionalReadings(pages, () => canonicalSection)).toThrow(
      'duplicate additional readings route: /fixtures/shared-route'
    )
  })
})

function contentPage(overrides: Partial<ContentPage> = {}): ContentPage {
  const kind: ContentPageKind = overrides.kind ?? 'lecture'
  const order = overrides.order ?? 1
  const route = overrides.route ?? `/fixtures/${kind}-${order}`
  return {
    kind,
    section: kind === 'lecture' ? 'lectures' : kind === 'service' ? 'service' : 'extras',
    sourcePath: `fixtures/${kind}-${order}.md`,
    outputPath: `fixtures/${kind}-${order}.md`,
    route,
    routeKey: route,
    title: `Fixture ${kind} ${order}`,
    description: 'Synthetic catalog page.',
    order,
    inclusion: {
      nav: false,
      sidebar: false,
      search: false,
      askAi: false,
      pdf: false,
      uiSweep: false,
      sitemap: false
    },
    ...overrides
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
