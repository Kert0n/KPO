import type MarkdownIt from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import container from 'markdown-it-container'

/**
 * Контейнер ::: multi-code — один пример на нескольких языках.
 *
 * ```md
 * ::: multi-code "Заголовок" {default=kotlin playground=off}
 * ```kotlin … ```
 * ```csharp … ```
 * :::
 * ```
 *
 * Устройство повторяет штатный ::: code-group из VitePress:
 * внутренние fence-блоки остаются обычными fence-токенами и проходят
 * весь стандартный пайплайн (Shiki, номера строк, кнопка копирования,
 * v-pre), а контейнер лишь оборачивает их в <CodeSwitcher>.
 * Блок языка по умолчанию получает маркер " active" — тот же механизм,
 * которым пользуется code-group, — чтобы SSR-разметка сразу показывала
 * нужный язык без мерцания.
 */

export const languageAliases = new Map<string, string>([
  ['kt', 'kotlin'],
  ['kts', 'kotlin'],
  ['cs', 'csharp'],
  ['c#', 'csharp'],
  ['golang', 'go']
])

const languageLabels: Record<string, string> = {
  kotlin: 'Kotlin',
  csharp: 'C#',
  java: 'Java',
  go: 'Go'
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

      const raw = token.info.trim().replace(/^only\s*/, '').trim().split(/\s+/)[0] ?? ''
      const lang = languageAliases.get(raw.toLowerCase()) ?? raw.toLowerCase()

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
      if (token.nesting === -1) return '</CodeSwitcher>\n'

      const { title, options } = parseInfo(token)
      const languages = collectLanguages(tokens, index)

      if (languages.length === 0) {
        console.warn('[multi-code] контейнер без блоков кода:', token.info)
        return '<CodeSwitcher langs="" title="">\n'
      }

      const requestedDefault = normalizeLanguage(options.get('default') ?? '')
      const defaultLang = languages.includes(requestedDefault) ? requestedDefault : languages[0]
      markDefaultFenceActive(tokens, index, defaultLang)

      const playgroundOff = /^(off|none|false|0)$/i.test(options.get('playground') ?? '')
      const playground = !playgroundOff && languages.includes('kotlin')

      const labels = languages.map((lang) => languageLabels[lang] ?? lang)

      return `<CodeSwitcher title="${escapeAttribute(title)}"`
        + ` langs="${languages.join(',')}"`
        + ` labels="${escapeAttribute(labels.join(','))}"`
        + ` default-lang="${defaultLang}"`
        + ` :playground="${playground}">\n`
    }
  })
}

/**
 * Извлекает заголовок в кавычках и опции вида {key=value key=value}.
 * Опции ищутся и в token.info, и в token.attrs: включённый в VitePress
 * markdown-it-attrs перехватывает конструкцию {…} до нашего рендера
 * и складывает пары в attrs, вырезая их из info.
 */
function parseInfo(token: Token): { title: string; options: Map<string, string> } {
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

/** Собирает нормализованные языки fence-блоков внутри контейнера. */
function collectLanguages(tokens: Token[], openIndex: number): string[] {
  const languages: string[] = []

  forEachInnerFence(tokens, openIndex, (fence, lang) => {
    if (languages.includes(lang)) {
      console.warn(`[multi-code] повторный блок языка "${lang}" — будет показан вместе с первым.`)
      return
    }
    languages.push(lang)
  })

  return languages
}

function markDefaultFenceActive(tokens: Token[], openIndex: number, defaultLang: string): void {
  let marked = false

  forEachInnerFence(tokens, openIndex, (fence, lang) => {
    if (!marked && lang === defaultLang && !/ active( |$)/.test(fence.info)) {
      fence.info += ' active'
      marked = true
    }
  })
}

function forEachInnerFence(
  tokens: Token[],
  openIndex: number,
  visit: (fence: Token, lang: string) => void
): void {
  for (let i = openIndex + 1; i < tokens.length; i += 1) {
    const token = tokens[i]
    if (token.type === 'container_multi-code_close') break
    if (token.type !== 'fence') continue

    visit(token, normalizeLanguage(token.info))
  }
}

function normalizeLanguage(info: string): string {
  const raw = info.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return languageAliases.get(raw) ?? raw
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
