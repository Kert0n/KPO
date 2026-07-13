import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog.ts'

const root = resolve(process.cwd())
const outputRoot = resolve(root, '.generated/kotlin-snippets')
const sourceRoot = resolve(outputRoot, 'src/main/kotlin')
const expectedCount = Number(readFileSync(resolve(root, 'kotlin-snippets.count'), 'utf8').trim())
const manifest: Array<{ source: string; line: number; generated: string }> = []

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(sourceRoot, { recursive: true })
for (const page of getContentCatalog({ root, fresh: true }).filter(
  (entry) => entry.kind !== 'service'
)) {
  extractPage(page.sourcePath)
}
if (manifest.length !== expectedCount) {
  throw new Error(
    `Runnable Kotlin fence count changed: expected ${expectedCount}, found ${manifest.length}`
  )
}
writeFileSync(resolve(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Kotlin snippets: ${manifest.length}; manifest: .generated/kotlin-snippets/manifest.json`
)

function extractPage(sourcePath: string): void {
  const lines = readFileSync(resolve(root, sourcePath), 'utf8').split('\n')
  const containers: Array<{ name: string; playgroundOff: boolean }> = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const container = line.match(/^:{3,}\s+([\w-]+)(.*)$/)
    if (container) {
      containers.push({
        name: container[1],
        playgroundOff: /\{[^}]*\bplayground=(?:off|none|false|0)\b[^}]*\}/i.test(container[2])
      })
      continue
    }
    if (/^:{3,}\s*$/.test(line)) {
      containers.pop()
      continue
    }
    const fence = line.match(/^(`{3,})kotlin\s+([^`]*)$/)
    if (!fence) continue
    const runnable = fence[2].split(/\s+/).includes('playground')
    const disabled = containers.some((entry) => entry.name === 'multi-code' && entry.playgroundOff)
    const fenceStart = index
    const code: string[] = []
    index += 1
    while (index < lines.length && lines[index] !== fence[1]) {
      code.push(lines[index])
      index += 1
    }
    if (index >= lines.length)
      throw new Error(`Unclosed Kotlin fence: ${sourcePath}:${fenceStart + 1}`)
    if (!runnable || disabled) continue
    const number = manifest.length + 1
    const id = `Snippet${String(number).padStart(3, '0')}`
    const relativeGenerated = `src/main/kotlin/kpo/snippets/${id}.kt`
    const generated = resolve(outputRoot, relativeGenerated)
    mkdirSync(dirname(generated), { recursive: true })
    writeFileSync(generated, `package kpo.snippets.s${number}\n\n${code.join('\n')}\n`)
    manifest.push({ source: sourcePath, line: fenceStart + 1, generated: relativeGenerated })
  }
}
