import { describe, expect, it } from 'vitest'
import {
  extractAdditionalReadingsSection,
  parseAdditionalReadingsSection,
  parseLectureAdditionalReadings
} from '../additionalReadings'

describe('additional readings parser', () => {
  it('extracts the additional readings section', () => {
    const section = extractAdditionalReadingsSection(`# Лекция

## Резюме

Коротко.

## Дополнительное чтение

### База

- [Материал](https://example.com/)

## Мини-практика

Задание.`)

    expect(section).toContain('### База')
    expect(section).toContain('[Материал](https://example.com/)')
    expect(section).not.toContain('## Мини-практика')
  })

  it('returns null for an empty additional readings section', () => {
    expect(extractAdditionalReadingsSection('## Дополнительное чтение\n\n## Мини-практика')).toBeNull()
  })

  it('parses groups and links with optional notes', () => {
    const groups = parseAdditionalReadingsSection(`Вводная строка.

### Теория

- [Без заметки](https://example.com/a)
- [С заметкой](https://example.com/b) — короткое пояснение

### Видео

- [Доклад](https://example.com/video)`)

    expect(groups).toEqual([
      {
        title: 'Теория',
        items: [
          { title: 'Без заметки', url: 'https://example.com/a' },
          { title: 'С заметкой', url: 'https://example.com/b', note: 'короткое пояснение' }
        ]
      },
      {
        title: 'Видео',
        items: [{ title: 'Доклад', url: 'https://example.com/video' }]
      }
    ])
  })

  it('ignores groups without links', () => {
    expect(parseAdditionalReadingsSection('### Пусто\n\nТекст без ссылок.')).toEqual([])
  })

  it('parses lecture metadata from a lecture markdown file', () => {
    const reading = parseLectureAdditionalReadings('/repo/content/lectures/Lec15/vitepress.md', `---
title: Лекция 15. Итоговая тема
---

# Другое название

## Дополнительное чтение

### Материалы

- [Статья](https://example.com/article)`)

    expect(reading).toEqual({
      lecture: 15,
      title: 'Итоговая тема',
      url: '/lectures/15',
      groups: [
        {
          title: 'Материалы',
          items: [{ title: 'Статья', url: 'https://example.com/article' }]
        }
      ]
    })
  })

  it('skips markdown files outside lecture folders', () => {
    expect(parseLectureAdditionalReadings('/repo/content/extras/02/vitepress.md', '## Дополнительное чтение')).toBeNull()
  })
})
