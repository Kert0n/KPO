import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { delimiter, resolve } from 'node:path'
import type { RunnableKotlinExample } from './extract-playground-examples.mts'

const root = process.cwd()
const wrapper = process.platform === 'win32' ? 'gradlew.bat' : 'gradlew'
const manifest = JSON.parse(
  readFileSync(resolve(root, 'tooling/kotlin-snippets/build/generated/manifest.json'), 'utf8')
) as RunnableKotlinExample[]

const result = spawnSync(
  resolve(root, `tooling/kotlin-snippets/${wrapper}`),
  ['-p', 'tooling/kotlin-snippets', '--no-daemon', 'compileKotlin'],
  {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: javaEnvironment()
  }
)

const output = mapDiagnostics(`${result.stdout ?? ''}${result.stderr ?? ''}`, manifest)
process.stdout.write(output)

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

function javaEnvironment(): NodeJS.ProcessEnv {
  if (process.env.JAVA_HOME || process.platform === 'win32') return process.env
  const sdkmanJava = resolve(homedir(), '.sdkman/candidates/java/current')
  if (!existsSync(resolve(sdkmanJava, 'bin/java'))) return process.env
  return {
    ...process.env,
    JAVA_HOME: sdkmanJava,
    PATH: `${resolve(sdkmanJava, 'bin')}${delimiter}${process.env.PATH ?? ''}`
  }
}

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
