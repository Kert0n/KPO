import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import container from 'markdown-it-container'
import { normalizeLanguage } from '../shared/core/codeLanguage'
import { classifyMarkdownToken, findMatchingMultiCodeClose } from '../shared/core/markdownStructure'
import { askAiBlockAttribute, askAiBlockId } from './askAiAnchors'
import { escapeAttribute } from './htmlUtils'

/**
 * Контейнер ::: multi-code — один пример на нескольких языках.
 *
 * Важное разделение:
 *  - initialLang отвечает за SSR-разметку и первый paint;
 *  - authorDefaultLang существует только при явном {default=...};
 *  - глобальный язык читателя применяется уже в CodeSwitcher и только
 *    если авторский default не задан.
 */

const supportedOptions = new Set(['default', 'playground'])

const languageLabels: Record<string, string> = {
  kotlin: 'Kotlin',
  csharp: 'C#',
  java: 'Java',
  go: 'Go'
}

export type ContainerInfo = {
  title: string
  options: Map<string, string>
}

export type MultiCodeFence = {
  token: Token
  language: string
  playgroundOnly: boolean
}

export type MultiCodeMeta = {
  languages: string[]
  labels: string[]
  initialLang: string
  authorDefaultLang: string
  allowPlayground: boolean
  playgroundCode: string
}

/**
 * Контейнер ::: only <язык> — блок, видимый только когда глобально
 * выбран указанный язык. Показ управляется чистым CSS по атрибуту
 * html[data-kpo-lang] (см. code.css и useCodeLanguage), поэтому
 * никакой гидрации и мерцаний. Для строчных вставок есть парный
 * Vue-компонент <LangOnly lang="...">.
 */
export function langOnlyPlugin(md: MarkdownIt): void {
  md.use(container, 'only', {
    render(tokens: Token[], index: number) {
      const token = tokens[index]
      if (token.nesting === -1) return '</div>\n'

      const raw =
        token.info
          .trim()
          .replace(/^only\s*/, '')
          .trim()
          .split(/\s+/)[0] ?? ''
      const lang = normalizeLanguage(raw)

      if (!lang) {
        console.warn('[only] контейнер без языка:', token.info)
        return '<div class="kpo-only">\n'
      }

      return `<div class="kpo-only kpo-only--${lang}">\n`
    }
  })
}

export function multiCodePlugin(md: MarkdownIt): void {
  md.use(container, 'multi-code', {
    render(tokens: Token[], index: number) {
      const token = tokens[index]
      if (token.nesting === -1) return '</CodeSwitcher>\n</div>\n'

      const info = parseContainerInfo(token)
      warnUnsupportedOptions(info, token)

      const fences = collectCodeFences(tokens, index)
      const meta = resolveMultiCodeMeta(info, fences, token)

      if (meta.languages.length === 0) {
        console.warn('[multi-code] контейнер без блоков кода:', token.info)
        return (
          `<div class="kpo-content-block kpo-content-block--multi-code kpo-content-block--wide kpo-wide-block kpo-wide-block--code"${askAiBlockAttribute(token)}>\n` +
          `<CodeSwitcher title="${escapeAttribute(info.title)}" langs="" ask-block-id="${escapeAttribute(askAiBlockId(token))}">\n`
        )
      }

      markInitialFenceActive(fences, meta.initialLang)

      const authorDefaultAttribute = meta.authorDefaultLang
        ? ` author-default-lang="${meta.authorDefaultLang}"`
        : ''
      const playgroundCodeAttribute = meta.playgroundCode
        ? ` playground-code="${encodeURIComponent(meta.playgroundCode)}"`
        : ''

      return (
        `<div class="kpo-content-block kpo-content-block--multi-code kpo-content-block--wide kpo-wide-block kpo-wide-block--code"${askAiBlockAttribute(token)}>\n` +
        `<CodeSwitcher title="${escapeAttribute(info.title)}"` +
        ` langs="${meta.languages.join(',')}"` +
        ` labels="${escapeAttribute(meta.labels.join(','))}"` +
        ` initial-lang="${meta.initialLang}"` +
        ` ask-block-id="${escapeAttribute(askAiBlockId(token))}"` +
        authorDefaultAttribute +
        playgroundCodeAttribute +
        ` :allow-playground="${meta.allowPlayground}">\n`
      )
    }
  })
}

/**
 * Извлекает заголовок в кавычках и опции вида {key=value key=value}.
 * Опции ищутся и в token.info, и в token.attrs: включённый в VitePress
 * markdown-it-attrs перехватывает конструкцию {…} до нашего рендера
 * и складывает пары в attrs, вырезая их из info.
 */
export function parseContainerInfo(token: Token): ContainerInfo {
  const title = token.info.match(/"([^"]*)"/)?.[1] ?? ''
  const options = new Map<string, string>()

  for (const pair of (token.info.match(/\{([^}]*)\}/)?.[1] ?? '').split(/\s+/)) {
    const [key, value] = pair.split('=')
    if (key && value) options.set(key.toLowerCase(), value)
  }

  for (const [key, value] of token.attrs ?? []) {
    if (value) options.set(key.toLowerCase(), value)
  }

  return { title, options }
}

/** Собирает fence-блоки только внутри текущего контейнера. */
export function collectCodeFences(tokens: Token[], openIndex: number): MultiCodeFence[] {
  const fences: MultiCodeFence[] = []
  const seen = new Set<string>()
  const closeIndex = findMatchingMultiCodeClose(tokens, openIndex)
  const endIndex = closeIndex === -1 ? tokens.length : closeIndex

  for (let i = openIndex + 1; i < endIndex; i += 1) {
    const token = tokens[i]
    const classification = classifyMarkdownToken(tokens, i)
    if (classification?.kind !== 'code' && classification?.kind !== 'mermaid') continue

    const language = normalizeLanguage(classification.language ?? '')
    const playgroundOnly = isPlaygroundFence(token)
    if (seen.has(language)) {
      if (!playgroundOnly) {
        console.warn(
          `[multi-code] повторный блок языка "${language}" — будет показан вместе с первым.`
        )
      }
    } else {
      seen.add(language)
    }

    fences.push({ token, language, playgroundOnly })
  }

  return fences
}

export function resolveMultiCodeMeta(
  info: ContainerInfo,
  fences: MultiCodeFence[],
  token?: Token
): MultiCodeMeta {
  const languages = uniqueLanguages(fences)
  const requestedDefault = normalizeLanguage(info.options.get('default') ?? '')
  const authorDefaultLang = resolveAuthorDefault(requestedDefault, languages, token)
  const initialLang = authorDefaultLang || languages[0] || ''
  const playgroundOff = /^(off|none|false|0)$/i.test(info.options.get('playground') ?? '')
  const playgroundCode = playgroundOff ? '' : playgroundFenceCode(fences)
  const allowPlayground = !playgroundOff && languages.includes('kotlin')

  hidePlaygroundOnlyFences(fences)

  return {
    languages,
    labels: languages.map((lang) => languageLabels[lang] ?? lang),
    initialLang,
    authorDefaultLang,
    allowPlayground,
    playgroundCode
  }
}

function uniqueLanguages(fences: MultiCodeFence[]): string[] {
  const languages: string[] = []
  for (const fence of fences) {
    if (fence.playgroundOnly) continue
    if (!languages.includes(fence.language)) languages.push(fence.language)
  }
  return languages
}

function playgroundFenceCode(fences: MultiCodeFence[]): string {
  return (
    fences.find((fence) => fence.language === 'kotlin' && fence.playgroundOnly)?.token.content ?? ''
  )
}

function hidePlaygroundOnlyFences(fences: MultiCodeFence[]): void {
  for (const fence of fences) {
    if (!fence.playgroundOnly) continue

    fence.token.type = 'html_block'
    fence.token.tag = ''
    fence.token.info = ''
    fence.token.content = ''
    fence.token.children = null
  }
}

function isPlaygroundFence(token: Token): boolean {
  const parts = token.info.trim().toLowerCase().split(/\s+/)
  return normalizeLanguage(token.info) === 'kotlin' && parts.includes('playground')
}

function resolveAuthorDefault(
  requestedDefault: string,
  languages: string[],
  token?: Token
): string {
  if (!requestedDefault) return ''
  if (languages.includes(requestedDefault)) return requestedDefault

  console.warn(
    `[multi-code] default="${requestedDefault}" не найден среди языков блока` +
      (token ? `: ${token.info}` : '')
  )
  return ''
}

function warnUnsupportedOptions(info: ContainerInfo, token: Token): void {
  for (const key of info.options.keys()) {
    if (!supportedOptions.has(key)) {
      console.warn(`[multi-code] неизвестная опция "${key}": ${token.info}`)
    }
  }
}

function markInitialFenceActive(fences: MultiCodeFence[], initialLang: string): void {
  let marked = false

  for (const fence of fences) {
    if (fence.playgroundOnly) continue
    fence.token.info = fence.token.info.replace(/(^|\s)active(?=\s|$)/g, '').trim()

    if (!marked && fence.language === initialLang) {
      fence.token.info = `${fence.token.info} active`.trim()
      marked = true
    }
  }
}
