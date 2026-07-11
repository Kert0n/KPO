import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog.ts'

const root = resolve(import.meta.dirname, '..')
const catalog = getContentCatalog({ root, fresh: true })
const publicRoutes = new Set(
  catalog.filter((page) => page.kind !== 'service').map((page) => normalizeRoute(page.route))
)
const violations: string[] = []

for (const page of catalog) {
  const sourceFile = resolve(root, page.sourcePath)
  const markdown = readFileSync(sourceFile, 'utf8')
  for (const match of markdown.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+['"][^'"]*['"])?\)/g)) {
    const target = match[1].replace(/^<|>$/g, '')
    if (/^(?:https?:|mailto:|tel:|#)/.test(target)) continue
    const clean = decodeURIComponent(target.split(/[?#]/)[0])
    if (!clean) continue

    if (clean.startsWith('/') && !extname(clean)) {
      if (!publicRoutes.has(normalizeRoute(clean))) {
        violations.push(`${page.sourcePath}: missing internal route ${target}`)
      }
      continue
    }

    const candidates = clean.startsWith('/')
      ? [resolve(root, 'content/public', clean.slice(1))]
      : [resolve(dirname(sourceFile), clean), resolve(root, 'content/public', clean)]
    if (!candidates.some(existsSync)) {
      violations.push(`${page.sourcePath}: missing asset ${target}`)
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `Content link/asset violations:\n${violations.map((item) => `  - ${item}`).join('\n')}`
  )
}

process.stdout.write(`Content links/assets: OK (${catalog.length} pages)\n`)

function normalizeRoute(route: string): string {
  const normalized = `/${route}`.replace(/\/+/g, '/').replace(/\/index$/, '/')
  return normalized !== '/' ? normalized.replace(/\/$/, '') : normalized
}
