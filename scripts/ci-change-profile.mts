import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export type CiChangeProfile = 'content' | 'generated' | 'full'

export const GENERATED_PDF_PATH = 'output/pdf/kpo-course.pdf'

const CONTENT_ROOTS = [
  'content/home/',
  'content/intro/',
  'content/conclusion/',
  'content/lectures/',
  'content/extras/'
]

export function classifyChangedPaths(paths: readonly string[]): CiChangeProfile {
  const normalized = [...new Set(paths.map(normalizePath).filter(Boolean))]
  if (normalized.length === 0) return 'full'

  const sourcePaths = normalized.filter((path) => path !== GENERATED_PDF_PATH)
  if (sourcePaths.length === 0) return 'generated'

  return sourcePaths.every(isContentPath) ? 'content' : 'full'
}

export function isContentPath(path: string): boolean {
  const normalized = normalizePath(path)
  return CONTENT_ROOTS.some((root) => normalized.startsWith(root))
}

export function changedPathsForRange(base: string, head: string, cwd = process.cwd()): string[] {
  if (!isUsableSha(base) || !isUsableSha(head)) {
    throw new Error('Both base and head revisions are required')
  }

  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', base, head, '--'],
    { cwd, encoding: 'utf8' }
  )
  return output.split('\0').filter(Boolean)
}

export function profileForEvent(options: {
  eventName: string
  base?: string
  head?: string
  cwd?: string
}): CiChangeProfile {
  if (options.eventName === 'workflow_dispatch') return 'full'
  if (!['push', 'pull_request'].includes(options.eventName)) return 'full'

  try {
    return classifyChangedPaths(
      changedPathsForRange(options.base ?? '', options.head ?? '', options.cwd)
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`Cannot determine changed paths; using full CI profile: ${message}\n`)
    return 'full'
  }
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '').trim()
}

function isUsableSha(value: string): boolean {
  return Boolean(value) && !/^0+$/.test(value)
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

function runCli(): void {
  const profile = profileForEvent({
    eventName: argument('--event') ?? process.env.GITHUB_EVENT_NAME ?? '',
    base: argument('--base'),
    head: argument('--head')
  })
  const line = `profile=${profile}\n`
  const output = process.env.GITHUB_OUTPUT
  if (output) appendFileSync(output, line)
  process.stdout.write(line)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli()
