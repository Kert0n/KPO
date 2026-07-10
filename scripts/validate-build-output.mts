import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { getContentCatalog } from '../.vitepress/shared/content/contentCatalog'
import { SITE, siteUrl } from '../.vitepress/shared/site'

const root = process.cwd()
const dist = resolve(root, '.vitepress/dist')
const catalog = getContentCatalog(root)
const failures: string[] = []

for (const page of catalog.pages) {
  const html = resolve(dist, routeOutput(page.route))
  if (!existsSync(html)) failures.push(`missing HTML for ${page.route}: ${html}`)

  if (page.inclusion.askAi) {
    const context = resolve(dist, '__ask-ai-context', `${page.routeKey}.json`)
    if (!existsSync(context)) failures.push(`missing Ask AI context for ${page.route}`)
  }
}

const generatedPaths = walk(dist).map((path) => path.slice(dist.length + 1).replace(/\\/g, '/'))
for (const path of generatedPaths) {
  if (/(?:^|\/)(?:_template|_internal)(?:\/|$)/.test(path))
    failures.push(`internal path was published: ${path}`)
}

const sitemapPath = resolve(dist, 'sitemap.xml')
if (!existsSync(sitemapPath)) {
  failures.push('sitemap.xml was not generated')
} else {
  const sitemap = readFileSync(sitemapPath, 'utf8')
  for (const page of catalog.pages.filter((candidate) => candidate.inclusion.sitemap)) {
    const url = siteUrl(page.route)
    if (!sitemap.includes(`<loc>${url}</loc>`)) failures.push(`sitemap is missing ${url}`)
  }
  if (sitemap.includes(`${SITE.base}service-pages/`)) failures.push('service page leaked into sitemap')
}

if (failures.length > 0) {
  throw new Error(
    `Build output validation failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`
  )
}

process.stdout.write(`Validated build output for ${catalog.pages.length} catalog pages.\n`)

function routeOutput(route: string): string {
  if (route === '/') return 'index.html'
  const clean = route.replace(/^\/+|\/+$/g, '')
  return route.endsWith('/') ? `${clean}/index.html` : `${clean}.html`
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}
