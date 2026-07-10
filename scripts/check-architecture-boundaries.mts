import { readFileSync, readdirSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const root = process.cwd()
const violations: string[] = []

for (const file of walk(resolve(root, '.vitepress/theme/styles'))) {
  if (extname(file) !== '.css' || file.includes('/styles/adapters/')) continue
  const source = readFileSync(file, 'utf8')
  if (/(?:^|[\s,>+~:(])\.(?:VP[A-Za-z0-9_-]*|vp-doc|DocSearch-[A-Za-z0-9_-]*)/m.test(source)) {
    violations.push(`${pathOf(file)}: VitePress selector outside styles/adapters`)
  }
}

checkImports('.vitepress/theme', (importer, imported) => {
  if (imported.includes('/.vitepress/lib/') || imported.includes('/.vitepress/markdown/')) {
    violations.push(`${pathOf(importer)}: theme imports build-time module ${pathOf(imported)}`)
  }
})

checkImports('.vitepress/markdown', (importer, imported) => {
  if (imported.includes('/.vitepress/theme/')) {
    violations.push(`${pathOf(importer)}: markdown imports theme module ${pathOf(imported)}`)
  }
})

for (const file of walk(resolve(root, '.vitepress/shared'))) {
  if (!/\.(?:ts|mts)$/.test(file)) continue
  const source = readFileSync(file, 'utf8')
  if (/from\s+['"](?:vue|vitepress)(?:\/[^'"]*)?['"]/.test(source)) {
    violations.push(`${pathOf(file)}: shared imports Vue or VitePress`)
  }
  if (/\b(?:window|document|HTMLElement|ResizeObserver)\b/.test(source)) {
    violations.push(`${pathOf(file)}: shared depends on browser DOM`)
  }
}

for (const file of walk(resolve(root, 'scripts'))) {
  if (!/\.(?:ts|mts|js|mjs)$/.test(file)) continue
  const source = readFileSync(file, 'utf8')
  if (/\b(?:PUBLIC_CONTENT_)?ROUTES\s*=\s*\[/.test(source)) {
    violations.push(`${pathOf(file)}: independent route array; use Content Catalog`)
  }
}

if (violations.length > 0) {
  throw new Error(`Architecture boundary violations:\n- ${violations.join('\n- ')}`)
}

process.stdout.write('Architecture boundaries validated.\n')

function checkImports(directory: string, check: (importer: string, imported: string) => void): void {
  for (const file of walk(resolve(root, directory))) {
    if (!/\.(?:ts|mts|vue)$/.test(file)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      if (!specifier.startsWith('.')) continue
      check(file, resolve(file, '..', specifier))
    }
  }
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function pathOf(path: string): string {
  return relative(root, path).replaceAll('\\', '/')
}
