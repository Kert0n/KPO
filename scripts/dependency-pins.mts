/**
 * Реестр пинов зависимостей и проверка, не пора ли их снять.
 *
 * Пин — это `overrides` в package.json или ignore-правило Dependabot. Каждый пин держится до
 * конкретного события у других пакетов: здесь это событие записано проверкой по npm-реестру.
 * Тест scripts/__tests__/dependency-pins.test.ts не даёт завести пин мимо реестра и следит,
 * чтобы таблица в docs/dependency-maintenance.md совпадала с ним.
 *
 *   node --experimental-strip-types scripts/dependency-pins.mts report
 *
 * печатает состояние всех пинов; в CI (GITHUB_TOKEN задан) ещё и открывает по issue на каждый
 * пин, который можно снять. Workflow: .github/workflows/maintenance.yml, раз в неделю.
 */
import { appendFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

type Manifest = {
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

export type Packument = {
  'dist-tags': Record<string, string>
  versions: Record<string, Manifest>
}

export interface PackageRegistry {
  packument(name: string): Promise<Packument>
}

export type PinLocation =
  | { kind: 'override'; path: string[]; version: string }
  | { kind: 'dependabot'; dependency: string; rule: string }

export type Verdict = { ready: boolean; evidence: string }

export type Pin = {
  id: string
  /** Совпадает с первой колонкой таблицы в docs/dependency-maintenance.md */
  title: string
  locations: PinLocation[]
  liftWhen: string
  check: (registry: PackageRegistry) => Promise<Verdict>
}

const MAJOR = 'semver-major'

export const PINS: readonly Pin[] = [
  {
    id: 'markdown-it-14',
    title: '`markdown-it` и `@types/markdown-it` на 14',
    locations: [
      { kind: 'dependabot', dependency: 'markdown-it', rule: MAJOR },
      { kind: 'dependabot', dependency: '@types/markdown-it', rule: MAJOR }
    ],
    liftWhen: 'стабильная VitePress перестанет требовать `@types/markdown-it` 14',
    async check(registry) {
      const vitepress = await latestManifest(registry, 'vitepress')
      const range = vitepress.manifest.dependencies?.['@types/markdown-it'] ?? ''
      return {
        ready: Boolean(range) && !semver.satisfies('14.99.0', range),
        evidence: `vitepress@${vitepress.version}: @types/markdown-it ${range || '(нет)'}`
      }
    }
  },
  {
    id: 'types-markdown-it-14.2.0',
    title: '`@types/markdown-it` не 14.2.0',
    locations: [{ kind: 'dependabot', dependency: '@types/markdown-it', rule: 'versions:14.2.0' }],
    liftWhen: 'выйдет `@types/markdown-it` новее 14.2.0',
    async check(registry) {
      const packument = await registry.packument('@types/markdown-it')
      const newer = stableVersions(packument).filter((version) => semver.gt(version, '14.2.0'))
      return {
        ready: newer.length > 0,
        evidence: newer.length > 0 ? `вышли ${newer.join(', ')}` : 'новее 14.2.0 ничего нет'
      }
    }
  },
  {
    id: 'markdown-it-mathjax3-4',
    title: '`markdown-it-mathjax3` на 4',
    locations: [{ kind: 'dependabot', dependency: 'markdown-it-mathjax3', rule: MAJOR }],
    liftWhen: 'стабильная VitePress разрешит последний мажор `markdown-it-mathjax3`',
    async check(registry) {
      const vitepress = await latestManifest(registry, 'vitepress')
      const mathjax = (await registry.packument('markdown-it-mathjax3'))['dist-tags'].latest
      const range = vitepress.manifest.peerDependencies?.['markdown-it-mathjax3'] ?? ''
      return {
        ready: Boolean(range) && semver.satisfies(mathjax, range),
        evidence: `vitepress@${vitepress.version} ждёт ${range || '(нет)'}, последняя ${mathjax}`
      }
    }
  },
  {
    id: 'typescript-6',
    title: 'TypeScript на 6',
    locations: [{ kind: 'dependabot', dependency: 'typescript', rule: MAJOR }],
    liftWhen: '`typescript-eslint` разрешит последний мажор TypeScript',
    async check(registry) {
      const eslint = await latestManifest(registry, 'typescript-eslint')
      const typescript = (await registry.packument('typescript'))['dist-tags'].latest
      const range = eslint.manifest.peerDependencies?.typescript ?? ''
      return {
        ready: Boolean(range) && semver.satisfies(typescript, range),
        evidence: `typescript-eslint@${eslint.version} поддерживает ${range}, последняя ${typescript}`
      }
    }
  },
  {
    id: 'vite-override',
    title: '`vitepress → vite 6.4.5`',
    locations: [{ kind: 'override', path: ['vitepress', 'vite'], version: '6.4.5' }],
    liftWhen: 'стабильная VitePress сама примет vite 6.4+',
    async check(registry) {
      const vitepress = await latestManifest(registry, 'vitepress')
      const range = vitepress.manifest.dependencies?.vite ?? ''
      return {
        ready: Boolean(range) && semver.satisfies('6.4.5', range),
        evidence: `vitepress@${vitepress.version}: vite ${range || '(нет)'}`
      }
    }
  },
  {
    id: 'xmldom-override',
    title: '`@xmldom/xmldom 0.9.12`',
    locations: [{ kind: 'override', path: ['@xmldom/xmldom'], version: '0.9.12' }],
    liftWhen: 'цепочка MathJax сама потребует `@xmldom/xmldom` ≥ 0.9.12',
    async check(registry) {
      const mathjax = await resolve(registry, 'markdown-it-mathjax3', '^4')
      const full = await resolve(registry, 'mathjax-full', dependency(mathjax, 'mathjax-full'))
      const sre = await resolve(
        registry,
        'speech-rule-engine',
        dependency(full, 'speech-rule-engine')
      )
      const range = dependency(sre, '@xmldom/xmldom')
      const floor = semver.minVersion(range)?.version ?? '0.0.0'
      return {
        ready: semver.gte(floor, '0.9.12'),
        evidence: `speech-rule-engine@${sre.version} требует @xmldom/xmldom ${range}`
      }
    }
  },
  {
    id: 'argparse-override',
    title: '`gray-matter → js-yaml → argparse 2.0.1`',
    locations: [
      { kind: 'override', path: ['gray-matter', 'js-yaml', 'argparse'], version: '2.0.1' }
    ],
    liftWhen: 'gray-matter перейдёт на js-yaml 4',
    async check(registry) {
      const grayMatter = await latestManifest(registry, 'gray-matter')
      const range = grayMatter.manifest.dependencies?.['js-yaml'] ?? ''
      const floor = semver.minVersion(range)?.version ?? '0.0.0'
      return {
        ready: semver.gte(floor, '4.0.0'),
        evidence: `gray-matter@${grayMatter.version}: js-yaml ${range}`
      }
    }
  }
]

type Resolved = { version: string; manifest: Manifest }

async function latestManifest(registry: PackageRegistry, name: string): Promise<Resolved> {
  const packument = await registry.packument(name)
  const version = packument['dist-tags'].latest
  return { version, manifest: packument.versions[version] ?? {} }
}

/** Самая свежая стабильная версия в диапазоне — то, что поставит npm. */
async function resolve(registry: PackageRegistry, name: string, range: string): Promise<Resolved> {
  const packument = await registry.packument(name)
  const version = semver.maxSatisfying(stableVersions(packument), range)
  if (!version) throw new Error(`${name}: нет стабильной версии в диапазоне ${range}`)
  return { version, manifest: packument.versions[version] ?? {} }
}

function dependency(resolved: Resolved, name: string): string {
  const range = resolved.manifest.dependencies?.[name]
  if (!range) throw new Error(`${resolved.version}: нет зависимости ${name}`)
  return range
}

function stableVersions(packument: Packument): string[] {
  return Object.keys(packument.versions).filter((version) => !semver.prerelease(version))
}

// ---------- Где пины живут на самом деле ----------

/** Пути всех overrides из package.json: { a: { b: '1' } } → a › b = 1 */
export function overridesOf(overrides: Record<string, unknown>): PinLocation[] {
  const locations: PinLocation[] = []
  const walk = (node: Record<string, unknown>, path: string[]) => {
    for (const [name, value] of Object.entries(node)) {
      if (typeof value === 'string')
        locations.push({ kind: 'override', path: [...path, name], version: value })
      else if (value && typeof value === 'object')
        walk(value as Record<string, unknown>, [...path, name])
    }
  }
  walk(overrides, [])
  return locations
}

/** Ignore-правила npm-раздела .github/dependabot.yml */
export function dependabotIgnoresOf(config: string): PinLocation[] {
  const npm = config.split(/\n\s*- package-ecosystem:/).find((part) => /^\s*npm\b/.test(part)) ?? ''
  const pattern = /- dependency-name: '?([^'\n]+?)'?\s*\n\s*(update-types|versions): \[([^\]]+)\]/g
  return [...npm.matchAll(pattern)].map((match) => {
    const values = match[3].split(',').map((value) => value.trim().replace(/^'|'$/g, ''))
    const rule =
      match[2] === 'update-types'
        ? values.map((value) => value.replace('version-update:', '')).join(',')
        : `versions:${values.join(',')}`
    return { kind: 'dependabot', dependency: match[1], rule }
  })
}

export function locationKey(location: PinLocation): string {
  return location.kind === 'override'
    ? `override ${location.path.join(' › ')} = ${location.version}`
    : `dependabot ${location.dependency} ${location.rule}`
}

// ---------- Отчёт и issues ----------

export const npmRegistry: PackageRegistry = {
  async packument(name) {
    // Имя целиком в один сегмент пути: @scope/name → %40scope%2Fname
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
    if (!response.ok) throw new Error(`npm ${name}: HTTP ${response.status}`)
    return (await response.json()) as Packument
  }
}

const ISSUE_LABEL = 'пин можно снять'

async function report(): Promise<void> {
  const results = await Promise.all(
    PINS.map(async (pin) => ({ pin, verdict: await pin.check(npmRegistry) }))
  )
  const lines = results.map(
    ({ pin, verdict }) =>
      `${verdict.ready ? '🟢 можно снять' : '⏳ держим'} · ${pin.title} — ${verdict.evidence}`
  )
  console.log(lines.join('\n'))
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `## Пины зависимостей\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`
    )
  }

  const ready = results.filter(({ verdict }) => verdict.ready)
  if (ready.length === 0 || !process.env.GITHUB_TOKEN) return
  const open = await openIssueTitles()
  for (const { pin, verdict } of ready) {
    const title = issueTitle(pin)
    if (open.has(title)) {
      console.log(`Issue уже открыт: ${title}`)
      continue
    }
    await github('/issues', {
      method: 'POST',
      body: JSON.stringify({ title, body: issueBody(pin, verdict), labels: [ISSUE_LABEL] })
    })
    console.log(`Открыт issue: ${title}`)
  }
}

export function issueTitle(pin: Pin): string {
  return `Можно снять пин: ${pin.title.replaceAll('`', '')}`
}

export function issueBody(pin: Pin, verdict: Verdict): string {
  return [
    `Еженедельная проверка пинов увидела, что условие выполнено: ${pin.liftWhen}.`,
    '',
    `**Факт:** ${verdict.evidence}`,
    '',
    '**Где пин:**',
    ...pin.locations.map((location) =>
      location.kind === 'override'
        ? `- \`overrides\` в \`package.json\`: ${location.path.join(' → ')} = ${location.version}`
        : `- ignore в \`.github/dependabot.yml\`: ${location.dependency} (${location.rule})`
    ),
    '',
    '**Как снять:** в одном PR убрать пин из конфигурации, из реестра `scripts/dependency-pins.mts` и из',
    'таблицы в `docs/dependency-maintenance.md`, обновить зависимости и прогнать полный gate.',
    '',
    `_Пин \`${pin.id}\`. Issue открыт автоматически workflow «Scheduled maintenance»._`
  ].join('\n')
}

async function openIssueTitles(): Promise<Set<string>> {
  const response = await github(
    `/issues?state=open&labels=${encodeURIComponent(ISSUE_LABEL)}&per_page=100`
  )
  const issues = (await response.json()) as { title: string }[]
  return new Set(issues.map((issue) => issue.title))
}

export async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const repository = requireEnv('GITHUB_REPOSITORY')
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${requireEnv('GITHUB_TOKEN')}`,
      'content-type': 'application/json',
      'x-github-api-version': '2022-11-28'
    }
  })
  if (!response.ok)
    throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: HTTP ${response.status}`)
  return response
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Нет переменной окружения ${name}`)
  return value
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'report') throw new Error('Режим: report')
  await report()
}
