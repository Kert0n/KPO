import { readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve('.vitepress/dist')
const files = walk(root)
const sizes = files.map((file) => ({ file, bytes: statSync(file).size }))
const limits = {
  js: 1024 * 1024,
  searchIndex: 1.5 * 1024 * 1024,
  css: 160 * 1024,
  context: 350 * 1024,
  contextAverage: 160 * 1024,
  html: 450 * 1024,
  dist: 28 * 1024 * 1024
}
const failures = []

// The search index, Ask AI contexts, and total dist size grow with published course
// content, so they keep headroom for several full articles. Ordinary runtime chunks
// remain subject to the stricter JS, CSS, HTML, and per-context limits above.
for (const entry of sizes) {
  const name = outputPath(entry.file)
  if (isSearchIndex(name) && entry.bytes > limits.searchIndex)
    failures.push(`${name}: search index ${entry.bytes}`)
  if (extname(name) === '.js' && !isSearchIndex(name) && entry.bytes > limits.js)
    failures.push(`${name}: JS ${entry.bytes}`)
  if (extname(name) === '.html' && entry.bytes > limits.html)
    failures.push(`${name}: HTML ${entry.bytes}`)
  if (name.includes('__ask-ai-context') && entry.bytes > limits.context)
    failures.push(`${name}: Ask AI context ${entry.bytes}`)
}
const css = total(sizes.filter((entry) => extname(entry.file) === '.css'))
const contextEntries = sizes.filter((entry) => entry.file.includes('__ask-ai-context'))
const contexts = total(contextEntries)
const contextAverage = contextEntries.length === 0 ? 0 : Math.ceil(contexts / contextEntries.length)
const dist = total(sizes)
const searchIndexEntries = sizes.filter((entry) => isSearchIndex(outputPath(entry.file)))
const runtimeJsEntries = sizes.filter(
  (entry) => extname(entry.file) === '.js' && !isSearchIndex(outputPath(entry.file))
)
if (css > limits.css) failures.push(`CSS total: ${css}`)
if (contextAverage > limits.contextAverage)
  failures.push(`Ask AI context average: ${contextAverage}`)
if (dist > limits.dist) failures.push(`dist total: ${dist}`)

console.log(
  JSON.stringify(
    {
      searchIndex: maxEntries(searchIndexEntries),
      jsMaxExcludingSearch: maxEntries(runtimeJsEntries),
      css,
      contexts,
      contextCount: contextEntries.length,
      contextAverage,
      htmlMax: max('.html'),
      dist
    },
    null,
    2
  )
)
if (failures.length) throw new Error(`Performance budgets exceeded:\n${failures.join('\n')}`)

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}
function total(entries) {
  return entries.reduce((sum, entry) => sum + entry.bytes, 0)
}

function outputPath(file) {
  return relative(root, file).replaceAll('\\', '/')
}

function isSearchIndex(path) {
  return /^assets\/chunks\/@localSearchIndexroot\.[^/]+\.js$/.test(path)
}

function maxEntries(entries) {
  return Math.max(0, ...entries.map((entry) => entry.bytes))
}

function max(extension) {
  return Math.max(
    0,
    ...sizes.filter((entry) => extname(entry.file) === extension).map((entry) => entry.bytes)
  )
}
