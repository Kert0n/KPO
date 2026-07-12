import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeLanguage } from '../../shared/core/codeLanguage'

const SCANNED_PATHS = ['content/lectures', 'content/extras', 'content/intro', 'README.md']

function markdownFiles(path: string): string[] {
  if (!existsSync(path)) return []
  if (path.endsWith('.md')) return [path]

  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name)
    if (entry.isDirectory()) return markdownFiles(child)
    if (entry.isFile() && child.endsWith('.md')) return [child]
    return []
  })
}

describe('public multi-code defaults', () => {
  it('does not repeat the natural first language as an author default', () => {
    const offenders = SCANNED_PATHS.flatMap(markdownFiles).flatMap((file) => {
      return redundantDefaults(readFileSync(file, 'utf8')).map(({ line, header }) => {
        return `${relative(process.cwd(), file)}:${line}: ${header}`
      })
    })

    expect(offenders).toEqual([])
  })

  it('classifies redundant defaults for every language', () => {
    expect(
      redundantDefaults(`
::: multi-code "Example" {default=java}
\`\`\`java
class Example {}
\`\`\`
\`\`\`go
package main
\`\`\`
:::
`)
    ).toEqual([
      {
        line: 2,
        header: '::: multi-code "Example" {default=java}'
      }
    ])

    expect(
      redundantDefaults(`
::: multi-code "Intentional" {default=go}
\`\`\`java
class Example {}
\`\`\`
\`\`\`go
package main
\`\`\`
:::
`)
    ).toEqual([])
  })
})

function redundantDefaults(source: string): Array<{ line: number; header: string }> {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const offenders: Array<{ line: number; header: string }> = []

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]
    const delimiter = header.match(/^\s*(:{3,})\s+multi-code\b/)?.[1]
    if (!delimiter) continue

    const requestedDefault = normalizeLanguage(
      header.match(/\{[^}]*\bdefault=([^\s}]+)[^}]*}/i)?.[1] ?? ''
    )
    if (!requestedDefault) continue

    const firstFence = firstVisibleFenceLanguage(lines, index + 1, delimiter)
    if (requestedDefault === firstFence) {
      offenders.push({ line: index + 1, header: header.trim() })
    }
  }

  return offenders
}

function firstVisibleFenceLanguage(
  lines: string[],
  start: number,
  containerDelimiter: string
): string {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].trim() === containerDelimiter) return ''
    const info = lines[index].match(/^\s*`{3,}\s*([^\s`]+)(.*)$/)
    if (!info) continue
    const language = normalizeLanguage(info[1])
    const modifiers = info[2].trim().toLowerCase().split(/\s+/)
    if (language === 'kotlin' && modifiers.includes('playground')) continue
    return language
  }
  return ''
}
