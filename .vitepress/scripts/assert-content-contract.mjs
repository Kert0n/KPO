import { readdirSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { assertMarkdownRouteContract } from '../lib/contentContract.ts'

const root = process.cwd()
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'output', 'test-results'])

const markdownFiles = []
walk(root)
assertMarkdownRouteContract(markdownFiles)

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
  if (name.startsWith('.') && name !== '.vitepress') return true
  if (ignoredDirectories.has(name)) return true
  return (
    relativePath === '.vitepress/cache' ||
    relativePath === '.vitepress/dist' ||
    relativePath.startsWith('.vitepress/cache/') ||
    relativePath.startsWith('.vitepress/dist/')
  )
}

function normalizePath(path) {
  return path.replace(/\\/g, '/').replace(/^\.\//, '')
}
