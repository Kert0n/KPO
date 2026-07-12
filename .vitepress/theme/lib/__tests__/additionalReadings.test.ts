import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  extractAdditionalReadingsSection,
  type LectureAdditionalReadings,
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
    expect(
      extractAdditionalReadingsSection('## Дополнительное чтение\n\n## Мини-практика')
    ).toBeNull()
  })

  it('parses groups and links with optional notes', () => {
    const groups = parseAdditionalReadingsSection(`Вводная строка.

### Теория

- [Без заметки](https://example.com/a)
- [С заметкой](https://example.com/b) — короткое пояснение
- [С ASCII дефисом](https://example.com/c) - еще одно пояснение

### Видео

- [Доклад](https://example.com/video)`)

    expect(groups).toEqual([
      {
        title: 'Теория',
        items: [
          { title: 'Без заметки', url: 'https://example.com/a' },
          { title: 'С заметкой', url: 'https://example.com/b', note: 'короткое пояснение' },
          {
            title: 'С ASCII дефисом',
            url: 'https://example.com/c',
            note: 'еще одно пояснение'
          }
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
    const reading = parseLectureAdditionalReadings(
      '/repo/content/lectures/Lec15/vitepress.md',
      `---
title: Лекция 15. Итоговая тема
---

# Другое название

## Дополнительное чтение

### Материалы

- [Статья](https://example.com/article)`
    )

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
    expect(
      parseLectureAdditionalReadings(
        '/repo/content/extras/02/vitepress.md',
        '## Дополнительное чтение'
      )
    ).toBeNull()
  })

  it('finds additional readings in real lectures 1-12', () => {
    const readings = readRealLectureReadings()
    const lectureNumbers = readings.map((reading) => reading.lecture)

    expect(lectureNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(lectureNumbers).toEqual([...lectureNumbers].sort((a, b) => a - b))

    for (const reading of readings) {
      expect(reading.title).not.toHaveLength(0)
      expect(reading.groups.length).toBeGreaterThan(0)
      for (const group of reading.groups) {
        expect(group.title).not.toHaveLength(0)
        expect(group.items.length).toBeGreaterThan(0)
        for (const item of group.items) {
          expect(item.title).not.toHaveLength(0)
          expect(item.url).toMatch(/^https?:\/\//)
        }
      }
    }
  })
})

function readRealLectureReadings(): LectureAdditionalReadings[] {
  const lecturesRoot = resolve(process.cwd(), 'content/lectures')

  return readdirSync(lecturesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^Lec\d+$/.test(entry.name))
    .map((entry) => resolve(lecturesRoot, entry.name, 'vitepress.md'))
    .map((filePath) => parseLectureAdditionalReadings(filePath, readFileSync(filePath, 'utf8')))
    .filter((reading): reading is LectureAdditionalReadings => reading !== null)
    .sort((a, b) => a.lecture - b.lecture)
}
