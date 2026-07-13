import { readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = resolve('.vitepress/dist')
const files = walk(root)
const sizes = files.map((file) => ({ file, bytes: statSync(file).size }))
const limits = {
  js: 1024 * 1024,
  css: 160 * 1024,
  context: 350 * 1024,
  contextAverage: 128 * 1024,
  html: 450 * 1024,
  dist: 22 * 1024 * 1024
}
const failures = []

for (const entry of sizes) {
  const name = relative(root, entry.file)
  if (extname(name) === '.js' && entry.bytes > limits.js)
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
if (css > limits.css) failures.push(`CSS total: ${css}`)
if (contextAverage > limits.contextAverage)
  failures.push(`Ask AI context average: ${contextAverage}`)
if (dist > limits.dist) failures.push(`dist total: ${dist}`)

console.log(
  JSON.stringify(
    {
      jsMax: max('.js'),
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
function max(extension) {
  return Math.max(
    0,
    ...sizes.filter((entry) => extname(entry.file) === extension).map((entry) => entry.bytes)
  )
}
