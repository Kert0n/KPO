type MarkdownIt = any
type StateBlock = any
type Token = any

type CodeBlock = {
  lang: SupportedLanguage
  label: string
  code: string
  highlightedHtml: string
}

type SupportedLanguage = 'kotlin' | 'csharp' | 'java' | 'go'

const languageLabels: Record<SupportedLanguage, string> = {
  kotlin: 'Kotlin',
  csharp: 'C#',
  java: 'Java',
  go: 'Go'
}

const languageAliases = new Map<string, SupportedLanguage>([
  ['kotlin', 'kotlin'],
  ['kt', 'kotlin'],
  ['csharp', 'csharp'],
  ['cs', 'csharp'],
  ['java', 'java'],
  ['go', 'go']
])

export function multiCodePlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'multi_code', createBlockRule())
  md.renderer.rules.multi_code = renderMultiCode(md)
}

function createBlockRule() {
  return (state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean => {
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const end = state.eMarks[startLine]
    const marker = state.src.slice(start, end)
    const match = marker.match(/^:::\s*multi-code(.*)$/)

    if (!match) return false
    if (silent) return true

    let nextLine = startLine + 1
    let foundClose = false

    while (nextLine < endLine) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine]
      const lineEnd = state.eMarks[nextLine]
      const line = state.src.slice(lineStart, lineEnd)

      if (/^:::\s*$/.test(line)) {
        foundClose = true
        break
      }

      nextLine += 1
    }

    if (!foundClose) return false

    const token = state.push('multi_code', 'CodeSwitcher', 0)
    token.block = true
    token.info = match[1].trim()
    token.content = state.getLines(startLine + 1, nextLine, state.blkIndent, false)
    token.map = [startLine, nextLine + 1]

    state.line = nextLine + 1
    return true
  }
}

function renderMultiCode(md: MarkdownIt) {
  return (tokens: Token[], index: number): string => {
    const token = tokens[index]
    const parsedInfo = parseInfo(token.info)
    const result = parseCodeBlocks(token.content, md)
    const warnings = [...parsedInfo.warnings, ...result.warnings]

    if (result.blocks.length === 0) {
      warnings.push('В multi-code не найдено поддерживаемых блоков кода.')
    }

    const defaultLang = result.blocks.some((block) => block.lang === parsedInfo.defaultLang)
      ? parsedInfo.defaultLang
      : result.blocks[0]?.lang ?? 'kotlin'
    const disablePlayground = /\bplayground\s*=\s*(none|false|off)\b/i.test(token.info)
    const playgroundLang = !disablePlayground && result.blocks.some((block) => block.lang === 'kotlin')
      ? 'kotlin'
      : ''

    const warningHtml = warnings.length > 0
      ? `<div class="multi-code-warning">${warnings.map(escapeHtml).join('<br>')}</div>`
      : ''

    return `${warningHtml}<CodeSwitcher title="${escapeAttribute(parsedInfo.title)}" default-lang="${defaultLang}" playground-lang="${playgroundLang}" blocks-json="${encodeURIComponent(JSON.stringify(result.blocks))}"></CodeSwitcher>`
  }
}

function parseInfo(info: string): { title: string; defaultLang: SupportedLanguage; playgroundLang?: SupportedLanguage; warnings: string[] } {
  const warnings: string[] = []
  const title = info.match(/"([^"]+)"/)?.[1] ?? ''
  const options = info.match(/\{([^}]+)\}/)?.[1] ?? ''
  const parsedOptions = new Map<string, string>()

  for (const option of options.split(/\s+/).filter(Boolean)) {
    const [key, value] = option.split('=')
    if (key && value) parsedOptions.set(key, value)
  }

  const defaultLang = normalizeLanguage(parsedOptions.get('default') ?? 'kotlin')
  const rawPlaygroundLang = parsedOptions.get('playground') ?? (/\bplayground\s*=\s*kotlin\b/i.test(info) ? 'kotlin' : '')
  const playgroundLang = normalizeLanguage(rawPlaygroundLang)

  if (!defaultLang) {
    warnings.push(`Неподдерживаемый язык по умолчанию: ${parsedOptions.get('default')}.`)
  }

  if ((parsedOptions.has('playground') || rawPlaygroundLang) && playgroundLang !== 'kotlin') {
    warnings.push('Playground поддерживается только для Kotlin.')
  }

  return {
    title,
    defaultLang: defaultLang ?? 'kotlin',
    playgroundLang: playgroundLang ?? undefined,
    warnings
  }
}

function parseCodeBlocks(content: string, md: MarkdownIt): { blocks: CodeBlock[]; warnings: string[] } {
  const warnings: string[] = []
  const blocks = new Map<SupportedLanguage, CodeBlock>()
  const fencePattern = /```([^\n`]*)\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = fencePattern.exec(content)) !== null) {
    const rawLanguage = match[1].trim().split(/\s+/)[0]
    const lang = normalizeLanguage(rawLanguage)
    const code = trimTrailingNewLine(match[2])

    if (!lang) {
      warnings.push(`Неподдерживаемый язык "${rawLanguage || 'без имени'}". Используйте kotlin, csharp, java или go.`)
      continue
    }

    if (blocks.has(lang)) {
      warnings.push(`Повторный блок ${languageLabels[lang]} заменил предыдущий.`)
    }

    blocks.set(lang, {
      lang,
      label: languageLabels[lang],
      code,
      highlightedHtml: highlightCode(md, code, lang)
    })
  }

  return { blocks: [...blocks.values()], warnings }
}

function normalizeLanguage(language: string): SupportedLanguage | undefined {
  return languageAliases.get(language.toLowerCase())
}

function highlightCode(md: MarkdownIt, code: string, lang: SupportedLanguage): string {
  const highlighted = md.options.highlight?.(code, lang, '') || escapeHtml(code)

  if (highlighted.trimStart().startsWith('<pre')) {
    return highlighted
  }

  return `<pre class="shiki vp-code"><code>${highlighted}</code></pre>`
}

function trimTrailingNewLine(value: string): string {
  return value.replace(/\r?\n$/, '')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;')
}
