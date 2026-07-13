import { normalizeLanguage } from './codeLanguage'

export type RedundantMultiCodeDefault = { line: number; header: string }

export function redundantMultiCodeDefaults(source: string): RedundantMultiCodeDefault[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const offenders: RedundantMultiCodeDefault[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index]
    const delimiter = header.match(/^\s*(:{3,})\s+multi-code\b/)?.[1]
    if (!delimiter) continue
    const requestedDefault = normalizeLanguage(
      header.match(/\{[^}]*\bdefault=([^\s}]+)[^}]*}/i)?.[1] ?? ''
    )
    if (!requestedDefault) continue
    if (requestedDefault === firstVisibleFenceLanguage(lines, index + 1, delimiter)) {
      offenders.push({ line: index + 1, header: header.trim() })
    }
  }
  return offenders
}

export function extractMermaidBlocks(markdown: string): string[] {
  return [...markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((match) => match[1])
}

function firstVisibleFenceLanguage(
  lines: string[],
  start: number,
  containerDelimiter: string
): string {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].trim() === containerDelimiter) return ''
    const info = lines[index].match(/^\s*`{3,}\s*([^\s`]+)(.*)$/)
    if (!info) continue
    const language = normalizeLanguage(info[1])
    const modifiers = info[2].trim().toLowerCase().split(/\s+/)
    if (language === 'kotlin' && modifiers.includes('playground')) continue
    return language
  }
  return ''
}
