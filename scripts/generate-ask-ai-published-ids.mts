import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { format, resolveConfig } from 'prettier'

const contextsDirectory = resolve(process.argv[2] ?? '.vitepress/dist/__ask-ai-context')
const output = resolve(process.argv[3] ?? '.vitepress/shared/core/askAiLegacyIds.ts')
const ids: Record<string, string> = {}
const occurrences = new Map<string, number>()

for (const file of contextFiles(contextsDirectory)) {
  const context = JSON.parse(readFileSync(file, 'utf8')) as {
    sourcePath: string
    blocks: Array<{ id: string; kind: string; markdown: string }>
  }
  for (const block of context.blocks) {
    const canonical = canonicalizeAskAiBlockIdentity(block.kind, block.markdown)
    const occurrenceKey = `${normalizeSourcePath(context.sourcePath)}\u0000${block.kind}\u0000${canonical}`
    const duplicateIndex = occurrences.get(occurrenceKey) ?? 0
    occurrences.set(occurrenceKey, duplicateIndex + 1)
    ids[manifestKey(context.sourcePath, block.kind, canonical, duplicateIndex)] = block.id
  }
}

const source =
  `import { stableHash } from './hash'\n\n` +
  `const publishedAskAiIds: Record<string, string> = ${JSON.stringify(ids, null, 2)}\n\n` +
  `export function publishedAskAiCompatibilityEntries(): ReadonlyArray<{\n` +
  `  key: string\n` +
  `  legacyId: string\n` +
  `}> {\n` +
  `  return Object.entries(publishedAskAiIds).map(([key, legacyId]) => ({ key, legacyId }))\n` +
  `}\n\n` +
  `export function publishedAskAiId(\n` +
  `  sourcePath: string | undefined,\n` +
  `  kind: string,\n` +
  `  canonical: string,\n` +
  `  duplicateIndex: number\n` +
  `): string | null {\n` +
  `  if (!sourcePath) return null\n` +
  `  return publishedAskAiIds[manifestKey(sourcePath, kind, canonical, duplicateIndex)] ?? null\n` +
  `}\n\n` +
  `function manifestKey(\n` +
  `  sourcePath: string,\n` +
  `  kind: string,\n` +
  `  canonical: string,\n` +
  `  duplicateIndex: number\n` +
  `): string {\n` +
  `  return \`\${normalizeSourcePath(sourcePath)}:\${kind}:\${stableHash(canonical)}:\${duplicateIndex}\`\n` +
  `}\n\n` +
    `function normalizeSourcePath(sourcePath: string): string {\n` +
    `  const normalized = sourcePath.replace(/\\\\/g, '/')\n` +
    `  const contentIndex = normalized.lastIndexOf('/content/')\n` +
    `  const contentPath =\n` +
    `    contentIndex >= 0\n` +
    `      ? normalized.slice(contentIndex + 1)\n` +
    `      : normalized.startsWith('content/')\n` +
    `        ? normalized\n` +
    `        : \`content/\${normalized.replace(/^\\//, '')}\`\n` +
    `  return contentPath.replace(\n` +
    `    /^(content\\/(?:service-pages|extras)\\/[^/]+)\\.md$/,\n` +
    `    '$1/vitepress.md'\n` +
    `  )\n` +
    `}\n`

writeFileSync(
  output,
  await format(source, { ...(await resolveConfig(output)), parser: 'typescript' }),
  'utf8'
)

function contextFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? contextFiles(path) : entry.name.endsWith('.json') ? [path] : []
  })
}

function manifestKey(
  sourcePath: string,
  kind: string,
  canonical: string,
  duplicateIndex: number
): string {
  return `${normalizeSourcePath(sourcePath)}:${kind}:${stableHash(canonical)}:${duplicateIndex}`
}

function normalizeSourcePath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, '/')
  const contentIndex = normalized.lastIndexOf('/content/')
  if (contentIndex >= 0) return normalized.slice(contentIndex + 1)
  if (normalized.startsWith('content/')) return normalized
  return `content/${normalized.replace(/^\//, '')}`
}

function stableHash(value: string): string {
  let hash = 5381
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index)
  }
  return (hash >>> 0).toString(36)
}

function canonicalizeAskAiBlockIdentity(kind: string, markdown: string): string {
  return kind === 'multi-code' ? canonicalizeMultiCodeIdentity(markdown) : normalizeMarkdown(markdown)
}

function canonicalizeMultiCodeIdentity(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const first = lines.findIndex((line) => /^\s*:{3,}\s+multi-code\b/.test(line))
  if (first === -1) return normalizeMarkdown(markdown)

  const delimiter = lines[first].match(/^\s*(:{3,})/)?.[1] ?? ''
  const last = delimiter
    ? lines.findLastIndex((line, index) => index > first && line.trim() === delimiter)
    : -1
  const body = lines.slice(first + 1, last === -1 ? lines.length : last)
  const elements: string[] = []

  for (let index = 0; index < body.length; index += 1) {
    const fence = body[index].match(/^\s*(`{3,})\s*([^\s`]+).*$/)
    if (!fence) {
      const text = normalizeMarkdown(body[index])
      if (text) elements.push(`text:${text}`)
      continue
    }

    const fenceDelimiter = fence[1]
    const language = normalizeLanguage(fence[2])
    const code: string[] = []
    index += 1
    while (index < body.length && body[index].trim() !== fenceDelimiter) {
      code.push(body[index])
      index += 1
    }
    elements.push(`fence:${language}\n${normalizeMarkdown(code.join('\n'))}`)
  }

  return elements.join('\n\u001e\n')
}

function normalizeLanguage(value: string): string {
  const raw = value.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return (
    new Map([
      ['kt', 'kotlin'],
      ['kts', 'kotlin'],
      ['cs', 'csharp'],
      ['c#', 'csharp'],
      ['golang', 'go']
    ]).get(raw) ?? raw
  )
}

function normalizeMarkdown(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .trim()
}
