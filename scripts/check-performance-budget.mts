import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import budget from '../performance-budget.json' with { type: 'json' }

const root = process.cwd()
const dist = resolve(root, '.vitepress/dist')
const files = walk(dist)
const failures: string[] = []

assertMax('total dist', sum(files), budget.maxDistBytes)
assertMax('CSS bundle total', sum(files.filter((file) => file.endsWith('.css'))), budget.maxCssBytes)
assertMax(
  'Ask AI context total',
  sum(files.filter((file) => file.includes('/__ask-ai-context/'))),
  budget.maxAskAiContextsBytes
)

for (const file of files.filter((file) => file.endsWith('.js'))) {
  assertMax(relative(root, file), statSync(file).size, budget.maxJavaScriptChunkBytes)
}
for (const file of files.filter((file) => file.includes('/__ask-ai-context/'))) {
  assertMax(relative(root, file), statSync(file).size, budget.maxAskAiContextBytes)
}
for (const file of files.filter((file) => file.endsWith('.html'))) {
  assertMax(relative(root, file), statSync(file).size, budget.maxHtmlPageBytes)
}

if (failures.length > 0) {
  throw new Error(`Performance budget exceeded:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`)
}

process.stdout.write(`Performance budget passed for ${files.length} generated files.\n`)

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function sum(paths: string[]): number {
  return paths.reduce((total, path) => total + statSync(path).size, 0)
}

function assertMax(name: string, actual: number, maximum: number): void {
  if (actual <= maximum) return
  failures.push(`${name}: ${formatBytes(actual)} exceeds ${formatBytes(maximum)}`)
}

function formatBytes(value: number): string {
  return `${(value / 1024).toFixed(1)} KiB`
}
