import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import type { RunnableKotlinExample } from './extract-playground-examples.mts'

const root = process.cwd()
const manifest = JSON.parse(
  readFileSync(resolve(root, 'tooling/kotlin-snippets/build/generated/manifest.json'), 'utf8')
) as RunnableKotlinExample[]

const result = spawnSync(
  resolve(root, 'tooling/kotlin-snippets/gradlew'),
  ['-p', 'tooling/kotlin-snippets', '--no-daemon', 'compileKotlin'],
  { cwd: root, encoding: 'utf8' }
)

const output = mapDiagnostics(`${result.stdout ?? ''}${result.stderr ?? ''}`, manifest)
process.stdout.write(output)

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

function mapDiagnostics(value: string, examples: RunnableKotlinExample[]): string {
  let mapped = value
  for (const example of examples) {
    const absoluteGeneratedPath = resolve(root, example.generatedPath)
    const escapedPath = escapeRegExp(absoluteGeneratedPath)
    const diagnostic = new RegExp(`(?:file:\\/\\/)?${escapedPath}:(\\d+):(\\d+)`, 'g')
    mapped = mapped.replace(diagnostic, (_match, generatedLine: string, column: string) => {
      const markdownLine = example.line + Math.max(1, Number.parseInt(generatedLine, 10) - 2)
      return `${example.sourcePath}:${markdownLine}:${column}`
    })
  }
  return mapped
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
