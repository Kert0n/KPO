import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
const roots = ['content/lectures', 'content/extras', 'content/intro', 'README.md']
const failures: string[] = []

for (const file of roots.flatMap(markdownFiles)) {
  const source = readFileSync(file, 'utf8')
  for (const offender of redundantMultiCodeDefaults(source)) {
    failures.push(`${file}:${offender.line}: redundant multi-code default: ${offender.header}`)
  }
  for (const [index, block] of extractMermaidBlocks(source).entries()) {
    for (const diagnostic of lintMermaidCode(block)) {
      failures.push(`${file}:mermaid-${index + 1}:${diagnostic.line}: ${diagnostic.message}`)
    }
  }
  if (/content\/lectures\/Lec\d+\/vitepress\.md$/.test(file.replace(/\\/g, '/'))) {
    const sectionPresent = /^##\s+Дополнительное чтение\s*$/m.test(source)
    const hasReading = /^###\s+.+$/m.test(source) && /^\s*-\s+\[[^\]]+]\(https?:\/\//m.test(source)
    if (sectionPresent && !hasReading) {
      failures.push(`${file}: additional readings section has no valid groups`)
    }
  }
}

function redundantMultiCodeDefaults(source: string): Array<{ line: number; header: string }> {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const offenders: Array<{ line: number; header: string }> = []
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]
    const delimiter = header.match(/^\s*(:{3,})\s+multi-code\b/)?.[1]
    const requested = header.match(/\{[^}]*\bdefault=([^\s}]+)[^}]*}/i)?.[1]?.toLowerCase()
    if (!delimiter || !requested) continue
    const firstFence = lines
      .slice(index + 1)
      .find((line) => /^\s*`{3,}\s*[^\s`]+/.test(line) || line.trim() === delimiter)
    const language = firstFence?.match(/^\s*`{3,}\s*([^\s`]+)/)?.[1]?.toLowerCase() ?? ''
    if (language === requested) offenders.push({ line: index + 1, header: header.trim() })
  }
  return offenders
}

function extractMermaidBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1])
}

function lintMermaidCode(code: string): Array<{ line: number; message: string }> {
  const diagnostics: Array<{ line: number; message: string }> = []
  const isFlowchart = /^(flowchart|graph)\b/.test(code.trimStart())
  for (const [index, line] of code.split('\n').entries()) {
    if (isFlowchart && /<\||\|>/.test(line)) {
      diagnostics.push({ line: index + 1, message: 'classDiagram arrow inside flowchart' })
    }
    for (const match of line.matchAll(/\b[A-Za-z][\w-]*\[([^\]\n]+)]/g)) {
      const label = match[1].trim()
      if (/^".*"$/.test(label) || /^\(.+\)$/.test(label) || /^\[.+]$/.test(label)) continue
      if (/[()<>|{}]/.test(label)) {
        diagnostics.push({ line: index + 1, message: `unquoted special label: ${label}` })
      }
    }
  }
  return diagnostics
}

if (failures.length > 0) {
  throw new Error(
    `Content markdown checks failed:\n${failures.map((item) => `  - ${item}`).join('\n')}`
  )
}

console.log('Content markdown checks passed.')

function markdownFiles(path: string): string[] {
  if (!existsSync(path)) return []
  if (path.endsWith('.md')) return [relative(process.cwd(), path)]
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    if (entry.isDirectory()) return markdownFiles(child)
    if (entry.isFile() && child.endsWith('.md')) return [relative(process.cwd(), child)]
    return []
  })
}
