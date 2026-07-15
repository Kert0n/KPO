import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { GENERATED_PDF_PATH } from './ci-change-profile.mts'
import { isPdfSourcePath } from './pdf-source-fingerprint.mts'

export function findConflictingPdfInputs(options: {
  unstagedPaths: readonly string[]
  untrackedPaths: readonly string[]
}): string[] {
  return [...new Set([...options.unstagedPaths, ...options.untrackedPaths])]
    .filter(isPdfSourcePath)
    .sort()
}

function gitPaths(root: string, args: string[]): string[] {
  return execFileSync('git', [...args, '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
}

function run(root: string, command: string, args: string[]): void {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function runCli(): void {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const staged = gitPaths(root, ['diff', '--cached', '--name-only', '--no-renames'])
  const stagedInputs = staged.filter(isPdfSourcePath)
  const stagedPdf = staged.includes(GENERATED_PDF_PATH)

  if (stagedInputs.length === 0) {
    if (stagedPdf) run(root, 'npm', ['run', 'pdf:check'])
    return
  }

  const conflicts = findConflictingPdfInputs({
    unstagedPaths: gitPaths(root, ['diff', '--name-only', '--no-renames']),
    untrackedPaths: gitPaths(root, ['ls-files', '--others', '--exclude-standard'])
  })
  if (conflicts.length > 0) {
    throw new Error(
      'Cannot generate the commit PDF while PDF inputs have unstaged/untracked changes:\n' +
        conflicts.map((path) => `  - ${path}`).join('\n') +
        '\nStage or stash these files and retry the commit.'
    )
  }

  run(root, 'npm', ['run', 'pdf'])
  run(root, 'npm', ['run', 'pdf:check'])
  run(root, 'git', ['add', GENERATED_PDF_PATH])
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runCli()
