import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  checkedEditClasses,
  EDIT_CLASSES,
  labelsForNew,
  labelTargetFromEnv
} from '../edit-class-labels.mts'

const templatePath = (name: string) =>
  fileURLToPath(new URL(`../../.github/${name}`, import.meta.url))

describe('edit class labels', () => {
  it('reads the checked class from a task list', () => {
    const body = '## Класс\n\n- [ ] А. Форма\n- [x] Д. Дискуссионно — нет единого ответа\n'
    expect(checkedEditClasses(body).map((editClass) => editClass.name)).toEqual([
      'правка: дискуссионно'
    ])
  })

  it('accepts an uppercase X and asterisk bullets', () => {
    expect(checkedEditClasses('* [X] Б. Ошибка').map((editClass) => editClass.letter)).toEqual([
      'Б'
    ])
  })

  it('ignores unchecked items and look-alike lines', () => {
    expect(checkedEditClasses('- [ ] Г. Неверная модель\nДа. [x] Г. в тексте')).toEqual([])
  })

  it('always queues a new issue for triage, but never a pull request', () => {
    expect(labelsForNew('issue', '')).toEqual(['нужен разбор'])
    expect(labelsForNew('pull_request', '')).toEqual([])
    expect(labelsForNew('pull_request', '- [x] А. Форма')).toEqual(['правка: форма'])
  })

  it('accepts only a positive issue number and a known kind from the workflow', () => {
    expect(
      labelTargetFromEnv({ EVENT_KIND: 'issue', EVENT_NUMBER: '42', EVENT_BODY: '- [x] А. Форма' })
    ).toEqual({ kind: 'issue', number: 42, body: '- [x] А. Форма' })
    expect(labelTargetFromEnv({ EVENT_KIND: 'pull_request', EVENT_NUMBER: '7' }).body).toBe('')
    expect(() => labelTargetFromEnv({ EVENT_KIND: 'issue', EVENT_NUMBER: '1/../../x' })).toThrow()
    expect(() => labelTargetFromEnv({ EVENT_KIND: 'issue', EVENT_NUMBER: '0' })).toThrow()
    expect(() => labelTargetFromEnv({ EVENT_KIND: 'push', EVENT_NUMBER: '3' })).toThrow()
  })

  it('keeps every template checklist in sync with the classes', () => {
    const expected = EDIT_CLASSES.map((editClass) => editClass.letter)
    for (const template of [
      'ISSUE_TEMPLATE/content-error.md',
      'ISSUE_TEMPLATE/proposal.md',
      'pull_request_template.md'
    ]) {
      const source = readFileSync(templatePath(template), 'utf8')
      const letters = [...source.matchAll(/^- \[ \] ([А-ЯЁ])\./gm)].map((match) => match[1])
      expect(letters, template).toEqual(expected)
    }
  })
})
