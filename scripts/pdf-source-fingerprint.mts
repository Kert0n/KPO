import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const PDF_FINGERPRINT_VERSION = 'kpo-pdf-source-v1'
export const PDF_FINGERPRINT_PREFIX = 'KPO source SHA-256: '

export type PdfSourceEntry = {
  path: string
  content: Uint8Array
}

export function isPdfSourcePath(candidate: string): boolean {
  const path = normalizePath(candidate)

  if (path === 'package.json' || path === 'package-lock.json') return true
  if (path === 'scripts/export-pdf.mjs' || path === 'scripts/pdf-source-fingerprint.mts') {
    return true
  }
  if (path.startsWith('content/public/')) return true
  if (isPdfContentPath(path)) return true

  if (path === '.vitepress/config.mts') return true
  if (!path.startsWith('.vitepress/')) return false
  if (/^\.vitepress\/(?:cache|dist)\//.test(path)) return false
  if (/(?:^|\/)__tests__(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(path)) return false

  return /^\.vitepress\/(?:lib|markdown|shared|theme|types)\//.test(path)
}

export function fingerprintEntries(entries: readonly PdfSourceEntry[]): string {
  const hash = createHash('sha256')
  hash.update(`${PDF_FINGERPRINT_VERSION}\0`)

  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    const path = normalizePath(entry.path)
    const content = Buffer.from(entry.content)
    hash.update(`${Buffer.byteLength(path)}:`)
    hash.update(path)
    hash.update(`${content.byteLength}:`)
    hash.update(content)
  }

  return hash.digest('hex')
}

export function listPdfSourcePaths(root = process.cwd()): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      cwd: root,
      encoding: 'utf8'
    }
  )
  return output.split('\0').filter(Boolean).map(normalizePath).filter(isPdfSourcePath).sort()
}

export async function computePdfSourceFingerprint(root = process.cwd()): Promise<string> {
  const paths = listPdfSourcePaths(root)
  const entries = await Promise.all(
    paths.map(async (path) => ({ path, content: await readFile(resolve(root, path)) }))
  )
  return fingerprintEntries(entries)
}

function isPdfContentPath(path: string): boolean {
  if (/^content\/(?:intro|conclusion)\/(?:vitepress\.md|assets\/)/.test(path)) return true

  const match = path.match(/^content\/(lectures|extras)\/([^/]+)\/(.+)$/)
  if (!match) return false
  const [, section, page, rest] = match
  if (!page || page.startsWith('_') || page.startsWith('.')) return false
  if (section === 'extras' && page === 'index') {
    return rest === 'vitepress.md' || rest.startsWith('assets/')
  }
  return rest === 'vitepress.md' || rest.startsWith('assets/')
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '')
}
