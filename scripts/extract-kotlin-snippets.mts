import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { normalizeLanguage } from '../.vitepress/shared/core/codeLanguage.ts'
import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog.ts'

const root = resolve(process.cwd())
const outputRoot = resolve(root, '.generated/kotlin-snippets')
const sourceRoot = resolve(outputRoot, 'src/main/kotlin')
const manifest: Array<{ source: string; line: number; generated: string }> = []

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(sourceRoot, { recursive: true })
for (const page of getContentCatalog({ root, fresh: true }).filter(
  (entry) => entry.kind !== 'service'
)) {
  extractPage(page.sourcePath)
}
if (manifest.length === 0) {
  throw new Error('No runnable Kotlin fences found: snippet extraction is broken')
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
    const fence = line.match(/^(`{3,})([^`]*)$/)
    if (!fence) continue
    const runnable = isPlaygroundFenceInfo(fence[2])
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

// Same rule as isPlaygroundFence in .vitepress/markdown/multiCode.ts, so aliases such as
// `kt playground` are compiled exactly when the site treats them as runnable.
function isPlaygroundFenceInfo(info: string): boolean {
  const parts = info.trim().toLowerCase().split(/\s+/)
  return normalizeLanguage(info) === 'kotlin' && parts.includes('playground')
}
