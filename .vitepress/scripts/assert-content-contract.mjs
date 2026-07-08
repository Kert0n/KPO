import { readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'dist',
  'output',
  'test-results'
])

const publicSiteFiles = new Set([
  'content/home/vitepress.md',
  'content/intro/vitepress.md',
  'content/conclusion/vitepress.md',
  'content/extras/index/vitepress.md',
  'content/service-pages/ui-contract/vitepress.md'
])

const internalFiles = new Set([
  'README.md',
  'content/lectures/_template/README.md',
  'content/lectures/_template/vitepress.md',
  'content/extras/_template/README.md',
  'content/extras/_template/vitepress.md'
])

const markdownFiles = []
walk(root)

const unexpected = markdownFiles
  .filter((path) => classifyMarkdownPath(path) === 'unexpected')
  .sort((a, b) => a.localeCompare(b, 'en'))

if (unexpected.length > 0) {
  console.error('Unexpected markdown files. Site content must live under content/**/vitepress.md:')
  for (const path of unexpected) {
    console.error(`  - ${path}`)
  }
  process.exit(1)
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name)
    const relativePath = normalizePath(relative(root, absolutePath))

    if (entry.isDirectory()) {
      if (shouldIgnoreDirectory(relativePath, entry.name)) continue
      walk(absolutePath)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      markdownFiles.push(relativePath)
    }
  }
}

function shouldIgnoreDirectory(relativePath, name) {
  if (ignoredDirectories.has(name)) return true
  return relativePath === '.vitepress/cache'
    || relativePath === '.vitepress/dist'
    || relativePath.startsWith('.vitepress/cache/')
    || relativePath.startsWith('.vitepress/dist/')
}

function classifyMarkdownPath(path) {
  const normalized = normalizePath(path)

  if (publicSiteFiles.has(normalized)) return 'site'
  if (internalFiles.has(normalized)) return 'internal'
  if (/^content\/lectures\/Lec\d+\/vitepress\.md$/.test(normalized)) return 'site'
  if (/^content\/extras\/\d+\/vitepress\.md$/.test(normalized)) return 'site'
  if (/^content\/service-pages\/_internal\/[^/]+\/vitepress\.md$/.test(normalized)) return 'internal'

  return 'unexpected'
}

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}
