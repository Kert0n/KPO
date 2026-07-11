import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SCANNED_PATHS = ['content/lectures', 'content/extras', 'content/intro', 'README.md']
const DEFAULT_KOTLIN_PATTERN = /\bmulti-code\b[^\n]*\{[^}\n]*\bdefault=kotlin\b[^}\n]*\}/

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
  it('does not use default=kotlin as boilerplate in public content', () => {
    const offenders = SCANNED_PATHS.flatMap(markdownFiles).flatMap((file) => {
      return readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => {
          if (!DEFAULT_KOTLIN_PATTERN.test(line)) return []
          return `${relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`
        })
    })

    expect(offenders).toEqual([])
  })
})
