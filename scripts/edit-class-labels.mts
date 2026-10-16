/**
 * Классы правок и метки для них (см. CONTRIBUTING.md, «Классы правок»).
 *
 * Студент отмечает класс галочкой в шаблоне issue или PR: ставить метки сам он не может,
 * на GitHub это право есть только у участников с доступом triage. Workflow
 * edit-class-labels.yml при открытии переносит галочку в метку. Срабатывает только при
 * открытии, поэтому метку, переставленную мейнтейнером, не откатывает.
 *
 *   node --experimental-strip-types scripts/edit-class-labels.mts sync   — создать и обновить метки
 *   node --experimental-strip-types scripts/edit-class-labels.mts apply  — разметить issue или PR
 *                                         (EVENT_KIND, EVENT_NUMBER, EVENT_BODY из workflow)
 */
import { fileURLToPath } from 'node:url'

export type LabelDefinition = { name: string; color: string; description: string }
export type EditClass = LabelDefinition & { letter: string }

export const EDIT_CLASSES: readonly EditClass[] = [
  {
    letter: 'А',
    name: 'правка: форма',
    color: 'c5def5',
    description: 'Опечатка, пунктуация, разметка, битая ссылка'
  },
  {
    letter: 'Б',
    name: 'правка: ошибка',
    color: 'd73a4a',
    description: 'Неверный проверяемый факт или неработающий пример кода'
  },
  {
    letter: 'В',
    name: 'правка: устарело',
    color: 'fbca04',
    description: 'Было верно, но технология или практика изменилась'
  },
  {
    letter: 'Г',
    name: 'правка: модель',
    color: 'e99695',
    description: 'Неверно описано, что это и зачем нужно'
  },
  {
    letter: 'Д',
    name: 'правка: дискуссионно',
    color: 'd4c5f9',
    description: 'Нет единого ответа, а текст подаёт одну позицию как единственную'
  },
  {
    letter: 'Е',
    name: 'правка: подача',
    color: 'bfdadc',
    description: 'Верно, но непонятно: порядок, пример, аналогия'
  },
  {
    letter: 'Ж',
    name: 'правка: согласованность',
    color: 'f9d0c4',
    description: 'Противоречие между лекциями или разные термины'
  },
  {
    letter: 'З',
    name: 'правка: новое',
    color: '0e8a16',
    description: 'Нового раздела или темы нет в курсе'
  }
]

export const NEEDS_TRIAGE: LabelDefinition = {
  name: 'нужен разбор',
  color: 'ededed',
  description: 'Мейнтейнер ещё не разобрал issue'
}

export const STATUS_LABELS: readonly LabelDefinition[] = [
  NEEDS_TRIAGE,
  { name: 'принято', color: '0e8a16', description: 'Разбор пройден: можно делать PR' },
  { name: 'нужны уточнения', color: 'fef2c0', description: 'Нужны детали от автора' },
  { name: 'не будет сделано', color: 'ffffff', description: 'Отклонено, причина в комментарии' },
  {
    name: 'можно взять',
    color: '7057ff',
    description: 'Принятый issue, который может сделать любой'
  }
]

/** Классы, отмеченные в теле: строки вида «- [x] Д. Дискуссионно …». */
export function checkedEditClasses(body: string): EditClass[] {
  const letters = new Set(
    [...body.matchAll(/^\s*[-*]\s*\[[xX]\]\s*([А-ЯЁ])\./gm)].map((match) => match[1])
  )
  return EDIT_CLASSES.filter((editClass) => letters.has(editClass.letter))
}

/**
 * Метки для нового issue или PR. Отмечено несколько классов — ставим все: мейнтейнер
 * уберёт лишние при разборе. Ничего не отмечено — только «нужен разбор» для issue.
 */
export function labelsForNew(kind: 'issue' | 'pull_request', body: string): string[] {
  const classes = checkedEditClasses(body).map((editClass) => editClass.name)
  return kind === 'issue' ? [...classes, NEEDS_TRIAGE.name] : classes
}

export type LabelTarget = { kind: 'issue' | 'pull_request'; number: number; body: string }

/**
 * Что размечать. Workflow передаёт номер, тип и тело через env, а не через файл события:
 * так в запрос к API попадают только проверенный номер и метки из списка выше.
 */
export function labelTargetFromEnv(env: NodeJS.ProcessEnv): LabelTarget {
  const kind = env.EVENT_KIND
  if (kind !== 'issue' && kind !== 'pull_request') {
    throw new Error(`EVENT_KIND должен быть issue или pull_request, а не «${kind ?? ''}»`)
  }
  const number = Number(env.EVENT_NUMBER)
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(
      `EVENT_NUMBER должен быть номером issue или PR, а не «${env.EVENT_NUMBER ?? ''}»`
    )
  }
  return { kind, number, body: env.EVENT_BODY ?? '' }
}

async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const repository = requireEnv('GITHUB_REPOSITORY')
  return fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${requireEnv('GITHUB_TOKEN')}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28'
    }
  })
}

async function syncLabels(): Promise<void> {
  for (const label of [...EDIT_CLASSES, ...STATUS_LABELS]) {
    const payload = JSON.stringify({ color: label.color, description: label.description })
    const existing = await github(`/labels/${encodeURIComponent(label.name)}`)
    const response =
      existing.status === 404
        ? await github('/labels', {
            method: 'POST',
            body: JSON.stringify({
              name: label.name,
              color: label.color,
              description: label.description
            })
          })
        : await github(`/labels/${encodeURIComponent(label.name)}`, {
            method: 'PATCH',
            body: payload
          })
    if (!response.ok) throw new Error(`Метка «${label.name}»: HTTP ${response.status}`)
    console.log(`Метка «${label.name}» на месте`)
  }
}

async function applyLabels(): Promise<void> {
  const target = labelTargetFromEnv(process.env)
  const labels = labelsForNew(target.kind, target.body)
  if (labels.length === 0) {
    console.log('Класс не отмечен, метки не нужны')
    return
  }
  const response = await github(`/issues/${target.number}/labels`, {
    method: 'POST',
    body: JSON.stringify({ labels })
  })
  if (!response.ok) throw new Error(`Метки для #${target.number}: HTTP ${response.status}`)
  console.log(`#${target.number}: ${labels.join(', ')}`)
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Нет переменной окружения ${name}`)
  return value
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (mode === 'sync') await syncLabels()
  else if (mode === 'apply') await applyLabels()
  else throw new Error('Режим: sync или apply')
}
