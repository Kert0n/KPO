import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog'

const root = process.cwd()
const catalog = getContentCatalog(root)
const publicRoutes = catalog.pages.filter((page) => page.inclusion.sitemap)
const routeSet = new Set(catalog.pages.map((page) => normalizeRoute(page.route)))
const failures: string[] = []

for (const wrapper of [
  'gradlew',
  'gradlew.bat',
  'gradle/wrapper/gradle-wrapper.jar',
  'gradle/wrapper/gradle-wrapper.properties'
]) {
  if (!existsSync(resolve(root, 'tooling/kotlin-snippets', wrapper))) {
    failures.push(`missing Gradle Wrapper file: tooling/kotlin-snippets/${wrapper}`)
  }
}

if (publicRoutes.length === 0) failures.push('Content catalog must contain at least one public route.')

for (const page of catalog.pages) {
  const markdown = readFileSync(resolve(root, page.sourcePath), 'utf8')
  for (const target of markdownTargets(markdown)) validateTarget(page.sourcePath, target)
}

if (failures.length > 0) {
  throw new Error(`Content validation failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`)
}

process.stdout.write(`Validated ${catalog.pages.length} catalog pages (${publicRoutes.length} public).\n`)

function validateTarget(sourcePath: string, rawTarget: string): void {
  const target = rawTarget.trim().replace(/^<|>$/g, '')
  if (target === '' || target.startsWith('#') || /^(?:https?:|mailto:|tel:|data:)/i.test(target)) return

  const path = decodeURIComponent(target.split(/[?#]/)[0] ?? '')
  if (path === '') return

  if (path.startsWith('/')) {
    const normalized = normalizeRoute(path)
    if (routeSet.has(normalized)) return
    const publicAsset = resolve(root, 'content/public', path.slice(1))
    if (existsSync(publicAsset)) return
    failures.push(`${sourcePath}: unresolved internal target ${target}`)
    return
  }

  const absolute = resolve(root, dirname(sourcePath), path)
  if (!existsSync(absolute)) failures.push(`${sourcePath}: missing asset ${target}`)
}

function markdownTargets(markdown: string): string[] {
  const targets = [...markdown.matchAll(/!?\[[^\]]*]\(([^)\s]+(?:\s+"[^"]*")?)\)/g)].map((match) =>
    match[1].replace(/\s+"[^"]*"$/, '')
  )
  for (const match of markdown.matchAll(/<(?:img|a)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    targets.push(match[1])
  }
  return targets
}

function normalizeRoute(route: string): string {
  const path = route.split(/[?#]/)[0].replace(/\.html$/, '')
  if (path === '' || path === '/') return '/'
  return `/${path.replace(/^\/+|\/+$/g, '')}`
}
