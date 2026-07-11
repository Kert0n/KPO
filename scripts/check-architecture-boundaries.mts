import { readFileSync, readdirSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(root, '.vitepress')
const sourceExtensions = /\.(?:ts|mts|vue)$/
const importPattern = /(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g

const violations: string[] = []

for (const file of walk(sourceRoot)) {
  if (!sourceExtensions.test(file) || file.includes('/__tests__/')) continue
  const projectPath = normalize(relative(root, file))
  const source = readFileSync(file, 'utf8')

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1]
    if (projectPath.startsWith('.vitepress/shared/') && importsLayer(specifier, ['theme'])) {
      violations.push(`${projectPath}: shared code must not import theme code (${specifier})`)
    }
    if (
      (projectPath.startsWith('.vitepress/lib/') ||
        projectPath.startsWith('.vitepress/markdown/')) &&
      /(?:^|\/)theme\/(?:components|composables)(?:\/|$)/.test(normalize(specifier))
    ) {
      violations.push(
        `${projectPath}: build code must not import UI components/composables (${specifier})`
      )
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    `Architecture boundary violations:\n${violations.map((item) => `  - ${item}`).join('\n')}`
  )
}

process.stdout.write('Architecture boundaries: OK\n')

function importsLayer(specifier: string, layers: string[]): boolean {
  const normalized = normalize(specifier)
  return layers.some((layer) => new RegExp(`(?:^|/)${layer}(?:/|$)`).test(normalized))
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    if (!statSync(path).isDirectory()) return [path]
    if (['cache', 'dist', 'node_modules'].includes(name)) return []
    return walk(path)
  })
}

function normalize(value: string): string {
  return value.replace(/\\/g, '/')
}
