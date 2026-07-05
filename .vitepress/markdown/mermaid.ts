import type MarkdownIt from 'markdown-it'

export type MermaidLintDiagnostic = {
  message: string
  line: number
  snippet: string
}

type MermaidLintSource = {
  file?: string
  lineOffset?: number
}

/**
 * Fence-блоки ```mermaid превращаются в клиентский компонент
 * <MermaidDiagram>: библиотека mermaid тяжёлая и работает только
 * в браузере, поэтому рендер происходит после монтирования.
 *
 * Перед этим выполняется лёгкий build-time lint. Он ловит частый класс
 * ошибок Mermaid 11: незакавыченные labels со спецсимволами.
 */
export function mermaidPlugin(md: MarkdownIt): void {
  const defaultFence = md.renderer.rules.fence!

  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const token = tokens[index]

    if (token.info.trim() === 'mermaid') {
      const lineOffset = token.map?.[0] ?? 0

      assertValidMermaidCode(token.content, {
        file: markdownEnvPath(env),
        lineOffset
      })

      const diagramId = `kpo-mermaid-${stableHash(`${lineOffset}:${token.content}`)}`
      return '<div class="kpo-content-block kpo-content-block--mermaid kpo-content-block--wide kpo-wide-block kpo-wide-block--mermaid">\n'
        + `<MermaidDiagram code="${encodeURIComponent(token.content)}" diagram-id="${diagramId}"></MermaidDiagram>\n`
        + '</div>\n'
    }

    return defaultFence(tokens, index, options, env, self)
  }
}

export function assertValidMermaidCode(code: string, source: MermaidLintSource = {}): void {
  const diagnostics = lintMermaidCode(code)
  if (diagnostics.length === 0) return

  const first = diagnostics[0]
  const file = source.file ? `${source.file}:` : ''
  const line = (source.lineOffset ?? 0) + first.line

  throw new Error(
    `[mermaid] ${file}${line}: ${first.message}\n`
      + `  ${first.snippet}`
  )
}

export function lintMermaidCode(code: string): MermaidLintDiagnostic[] {
  const diagnostics: MermaidLintDiagnostic[] = []
  const labelPattern = /\b[A-Za-z][\w-]*\[([^\]\n]+)\]/g

  for (const [lineIndex, line] of code.split('\n').entries()) {
    for (const match of line.matchAll(labelPattern)) {
      const label = match[1].trim()
      if (isQuotedLabel(label) || isMermaidShapeLabel(label)) continue
      if (!/[()<>|{}]/.test(label)) continue

      diagnostics.push({
        line: lineIndex + 1,
        snippet: line.trim(),
        message: `label "${label}" содержит спецсимволы; используйте кавычки: ["${label}"]`
      })
    }
  }

  return diagnostics
}

function isQuotedLabel(label: string): boolean {
  return /^".*"$/.test(label)
}

function isMermaidShapeLabel(label: string): boolean {
  return (
    /^\(.+\)$/.test(label)
    || /^\[.+\]$/.test(label)
    || /^\{.+\}$/.test(label)
  )
}

function markdownEnvPath(env: unknown): string | undefined {
  if (!env || typeof env !== 'object') return undefined

  const candidate = env as {
    path?: string
    relativePath?: string
    file?: string
  }

  return candidate.relativePath ?? candidate.path ?? candidate.file
}

function stableHash(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(36)
}
