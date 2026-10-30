/**
 * Issues, которые ждут выпуска у апстрима, и проверка, не вышел ли он.
 *
 * Пины (scripts/dependency-pins.mts) снимаются по факту в npm-реестре; здесь то же самое, только
 * ждёт не пин в конфигурации, а открытый issue: «обновиться, когда выйдет VitePress 2». Когда
 * нужная версия появилась в реестре, в issue приходит один комментарий — повторно не пишется,
 * маркер в теле комментария помнит, о чём уже сообщили.
 *
 *   node --experimental-strip-types scripts/upstream-releases.mts report
 *
 * печатает состояние; в CI (GITHUB_TOKEN задан) ещё и комментирует issues.
 * Workflow: .github/workflows/maintenance.yml, раз в неделю.
 */
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import semver from 'semver'
import { github, npmRegistry, type PackageRegistry, type Packument } from './dependency-pins.mts'

export type Milestone = {
  id: string
  /** Подставляется в комментарий: «Вышла <title>» */
  title: string
  /** Первая версия, которая считается выходом. Пререлизы упорядочены: alpha < beta < rc < релиз */
  from: string
  stableOnly?: boolean
}

export type Watch = {
  issue: number
  package: string
  changelog: string
  /** Что сделать, когда версия вышла, — попадает в комментарий */
  then: string
  milestones: Milestone[]
}

export const WATCHES: readonly Watch[] = [
  {
    issue: 103,
    package: 'vitepress',
    changelog: 'https://github.com/vuejs/vitepress/blob/main/CHANGELOG.md',
    then:
      'проверить, сохраняется ли позиция чтения при перезагрузке (сценарий замера из issue); ' +
      'обновляться по плану — на стабильную версию',
    milestones: [
      { id: 'vitepress-2-beta', title: 'beta VitePress 2', from: '2.0.0-beta.0' },
      { id: 'vitepress-2-stable', title: 'стабильная VitePress 2', from: '2.0.0', stableOnly: true }
    ]
  }
]

/** Самая свежая версия, которая уже засчитывает веху, или undefined, если вехи ещё нет. */
export function reached(packument: Packument, milestone: Milestone): string | undefined {
  const versions = Object.keys(packument.versions).filter(
    (version) =>
      semver.gte(version, milestone.from) && !(milestone.stableOnly && semver.prerelease(version))
  )
  return versions.sort(semver.rcompare)[0]
}

export function marker(milestone: Milestone): string {
  return `<!-- upstream-releases:${milestone.id} -->`
}

export function commentBody(watch: Watch, milestone: Milestone, version: string): string {
  return [
    `Вышла ${milestone.title}: \`${watch.package}@${version}\`.`,
    '',
    `**Что сделать:** ${watch.then}.`,
    '',
    `Changelog: ${watch.changelog}`,
    '',
    '_Комментарий оставлен автоматически workflow «Scheduled maintenance» (`scripts/upstream-releases.mts`)._',
    marker(milestone)
  ].join('\n')
}

export type Status = { watch: Watch; milestone: Milestone; version: string | undefined }

export type GitHub = (path: string, init?: RequestInit) => Promise<Response>

export async function statuses(registry: PackageRegistry): Promise<Status[]> {
  const result: Status[] = []
  for (const watch of WATCHES) {
    const packument = await registry.packument(watch.package)
    for (const milestone of watch.milestones)
      result.push({ watch, milestone, version: reached(packument, milestone) })
  }
  return result
}

async function report(): Promise<void> {
  const results = await statuses(npmRegistry)
  const lines = results.map(({ watch, milestone, version }) =>
    version
      ? `🟢 вышла · ${milestone.title} — ${watch.package}@${version} (#${watch.issue})`
      : `⏳ ждём · ${milestone.title} — нет версии ≥ ${milestone.from} (#${watch.issue})`
  )
  console.log(lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Ожидаемые релизы\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`
    )
  }

  if (process.env.GITHUB_TOKEN) await notify(results, github)
}

/** Комментирует открытые issues о вехах, которые вышли и о которых там ещё не писали. */
export async function notify(results: Status[], gh: GitHub): Promise<void> {
  for (const { watch, milestone, version } of results) {
    if (!version) continue
    const issue = (await (await gh(`/issues/${watch.issue}`)).json()) as { state: string }
    if (issue.state !== 'open') {
      console.log(`#${watch.issue} закрыт, не комментирую: ${milestone.title}`)
      continue
    }
    const comments = (await (await gh(`/issues/${watch.issue}/comments?per_page=100`)).json()) as {
      body?: string
    }[]
    if (comments.some((comment) => comment.body?.includes(marker(milestone)))) {
      console.log(`#${watch.issue} уже знает: ${milestone.title}`)
      continue
    }
    await gh(`/issues/${watch.issue}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: commentBody(watch, milestone, version) })
    })
    console.log(`#${watch.issue}: сообщил, что вышла ${milestone.title}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'report') throw new Error('Режим: report')
  await report()
}
