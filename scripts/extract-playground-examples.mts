import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog'

export type RunnableKotlinExample = {
  id: string
  sourcePath: string
  line: number
  generatedPath: string
}

const root = process.cwd()
const outputDirectory = resolve(root, 'tooling/kotlin-snippets/build/generated/src/main/kotlin')
const manifestPath = resolve(root, 'tooling/kotlin-snippets/build/generated/manifest.json')

export function extractRunnableKotlinExamples(): RunnableKotlinExample[] {
  rmSync(outputDirectory, { recursive: true, force: true })
  mkdirSync(outputDirectory, { recursive: true })

  const examples: RunnableKotlinExample[] = []
  for (const page of getContentCatalog(root).pages.filter((candidate) => candidate.inclusion.search)) {
    const source = readFileSync(resolve(root, page.sourcePath), 'utf8').replace(/\r\n?/g, '\n')
    for (const match of playgroundFences(source)) {
      const id = `snippet-${String(examples.length + 1).padStart(3, '0')}`
      const generatedPath = join(outputDirectory, `${id}.kt`)
      const packageName = `kpo.snippets.${id.replace('-', '_')}`
      const code = addPackage(match.code, packageName, page.sourcePath, match.line)
      writeFileSync(generatedPath, code)
      examples.push({
        id,
        sourcePath: page.sourcePath,
        line: match.line,
        generatedPath: relative(root, generatedPath)
      })
    }
  }

  mkdirSync(dirname(manifestPath), { recursive: true })
  writeFileSync(manifestPath, `${JSON.stringify(examples, null, 2)}\n`)
  return examples
}

function* playgroundFences(source: string): Generator<{ code: string; line: number }> {
  const fence = /^```kotlin\s+playground\s*$\n([\s\S]*?)^```\s*$/gm
  for (const match of source.matchAll(fence)) {
    const start = match.index ?? 0
    const line = source.slice(0, start).split('\n').length
    yield { code: match[1], line }
  }
}

function addPackage(code: string, packageName: string, sourcePath: string, line: number): string {
  if (/^\s*package\s+/m.test(code)) {
    throw new Error(`${sourcePath}:${line}: runnable Kotlin examples must not declare a package.`)
  }

  const fileAnnotations = code.match(/^(?:\s*@file:[^\n]*\n)*/)?.[0] ?? ''
  const body = code.slice(fileAnnotations.length)
  return `${fileAnnotations}package ${packageName}\n\n${body.replace(/\n?$/, '\n')}`
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const examples = extractRunnableKotlinExamples()
  process.stdout.write(`Extracted ${examples.length} runnable Kotlin examples.\n`)
}
