export type ContentContractKind = 'site' | 'internal' | 'unexpected'

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

export function classifyMarkdownPath(path: string): ContentContractKind {
  const normalized = normalizePath(path)

  if (publicSiteFiles.has(normalized)) return 'site'
  if (internalFiles.has(normalized)) return 'internal'
  if (/^docs\/.+\.md$/.test(normalized)) return 'internal'
  if (/^content\/lectures\/Lec\d+\/vitepress\.md$/.test(normalized)) return 'site'
  if (/^content\/extras\/\d+\/vitepress\.md$/.test(normalized)) return 'site'
  if (/^content\/service-pages\/_internal\/[^/]+\/vitepress\.md$/.test(normalized)) return 'internal'

  return 'unexpected'
}

export function unexpectedMarkdownPaths(paths: string[]): string[] {
  return paths
    .map(normalizePath)
    .filter((path) => path.endsWith('.md'))
    .filter((path) => classifyMarkdownPath(path) === 'unexpected')
    .sort((a, b) => a.localeCompare(b, 'en'))
}

export function assertMarkdownRouteContract(paths: string[]): void {
  const unexpected = unexpectedMarkdownPaths(paths)
  if (unexpected.length === 0) return

  throw new Error(
    'Unexpected markdown files. Site content must live under content/**/vitepress.md:\n' +
      unexpected.map((path) => `  - ${path}`).join('\n')
  )
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}
