import type { AskAiBlockKind } from '../../lib/askAiIds'

export type AskAiProviderId = 'chatgpt' | 'claude' | 'deepseek' | 'clipboard'

export type AskAiBlock = {
  id: string
  kind: AskAiBlockKind
  title?: string
  language?: string
  markdown: string
  plainText: string
  lineStart: number
  lineEnd: number
}

export type AskAiPageContext = {
  courseTitle: string
  courseDescription: string
  pageTitle: string
  pageDescription: string
  sourcePath: string
  blocks: AskAiBlock[]
}

export type AskAiPromptInput = {
  pageContext: AskAiPageContext
  selectedText: string
  blockIds: string[]
  currentOverride?: {
    kind: AskAiBlockKind
    language?: string
    markdown: string
    title?: string
  }
  maxChars: number
}

export type AskAiProviderAction = {
  prompt: string
  copyPrompt: boolean
  openUrl: string | null
  toastKind: 'copied' | 'copied-and-opened' | 'manual-copy' | 'unavailable'
}

const DEFAULT_PROMPT_LIMIT = 12000
const CONTEXT_BEFORE_TARGET_CHARS = 1800
const CONTEXT_AFTER_TARGET_CHARS = 1800
const CONTEXT_SIDE_MAX_BLOCKS = 4
const SHORT_BRIDGE_BLOCK_CHARS = 140
const TRIM_MARKER = '\n[... фрагмент сокращен ...]\n'

export const ASK_AI_PROVIDERS: Array<{
  id: AskAiProviderId
  label: string
  menuLabel: string
}> = [
  { id: 'chatgpt', label: 'ChatGPT', menuLabel: 'Ask ChatGPT about this' },
  { id: 'claude', label: 'Claude', menuLabel: 'Ask Claude about this' },
  { id: 'deepseek', label: 'DeepSeek', menuLabel: 'Ask DeepSeek about this' },
  { id: 'clipboard', label: 'Copy', menuLabel: 'Copy AI prompt' }
]

export function isAskAiProviderId(value: string): value is AskAiProviderId {
  return ASK_AI_PROVIDERS.some((provider) => provider.id === value)
}

export function buildAskAiPrompt(input: AskAiPromptInput): string {
  const selectedText = normalizeText(input.selectedText)
  const blocks = input.pageContext.blocks
  const selectedIndexes = blockIndexes(blocks, input.blockIds)
  const firstIndex = selectedIndexes[0] ?? -1
  const lastIndex = selectedIndexes[selectedIndexes.length - 1] ?? firstIndex

  const before =
    firstIndex > 0
      ? collectBeforeContextBlocks(blocks, firstIndex, CONTEXT_BEFORE_TARGET_CHARS)
          .map((block) => blockToPromptText(block))
          .join('\n\n')
      : ''
  const after =
    lastIndex >= 0 && lastIndex < blocks.length - 1
      ? collectAfterContextBlocks(blocks, lastIndex, CONTEXT_AFTER_TARGET_CHARS)
          .map((block) => blockToPromptText(block))
          .join('\n\n')
      : ''
  const current = input.currentOverride
    ? blockToPromptText({
        id: 'runtime-current',
        kind: input.currentOverride.kind,
        language: input.currentOverride.language,
        title: input.currentOverride.title,
        markdown: input.currentOverride.markdown,
        plainText: input.currentOverride.markdown,
        lineStart: 0,
        lineEnd: 0
      })
    : selectedIndexes.map((index) => blockToPromptText(blocks[index])).join('\n\n')

  const sections = {
    before,
    current: current || selectedText,
    after,
    selected: selectedText
  }

  return trimPromptSections(input.pageContext, sections, input.maxChars)
}

export function resolveAskAiProviderAction(
  provider: AskAiProviderId,
  input: Omit<AskAiPromptInput, 'maxChars'>
): AskAiProviderAction {
  if (provider === 'chatgpt') {
    const prompt = buildAskAiPrompt({ ...input, maxChars: DEFAULT_PROMPT_LIMIT })
    return {
      prompt,
      copyPrompt: true,
      openUrl: 'https://chatgpt.com/',

      toastKind: 'copied-and-opened'
    }
  }

  const prompt = buildAskAiPrompt({ ...input, maxChars: DEFAULT_PROMPT_LIMIT })
  if (provider === 'clipboard') {
    return {
      prompt,
      copyPrompt: true,
      openUrl: null,

      toastKind: 'copied'
    }
  }

  return {
    prompt,
    copyPrompt: true,
    openUrl: provider === 'claude' ? 'https://claude.ai/new' : 'https://chat.deepseek.com/',
    toastKind: 'copied-and-opened'
  }
}

export function routePathToAskAiContextKey(path: string, base = '/'): string {
  const cleanPath = stripBase(
    path
      .split(/[?#]/)[0]
      .replace(/\.html$/, '')
      .replace(/^\/+/, ''),
    base
  )

  if (cleanPath === '') return 'index'
  if (cleanPath.endsWith('/')) return `${cleanPath}index`.replace(/^\/+/, '')
  return cleanPath
}

export function askAiContextUrlForRoute(
  path: string,
  base: string,
  withBase: (path: string) => string
): string {
  const key = routePathToAskAiContextKey(path, base)
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return withBase(`/__ask-ai-context/${encodedKey}.json`)
}

function stripBase(path: string, base: string): string {
  const normalizedPath = path.replace(/^\/+/, '')
  const normalizedBase = base.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!normalizedBase) return normalizedPath
  if (normalizedPath === normalizedBase) return ''
  if (normalizedPath.startsWith(`${normalizedBase}/`)) {
    return normalizedPath.slice(normalizedBase.length + 1)
  }
  return normalizedPath
}

function blockIndexes(blocks: AskAiBlock[], ids: string[]): number[] {
  const idSet = new Set(ids)
  return blocks
    .map((block, index) => (idSet.has(block.id) ? index : -1))
    .filter((index) => index !== -1)
}

function blockToPromptText(block: AskAiBlock): string {
  const label = blockLabel(block)
  return label ? `${label}\n${block.markdown.trim()}` : block.markdown.trim()
}

function isBridgeBlock(block: AskAiBlock): boolean {
  const plainText = normalizeText(block.plainText || block.markdown)
  if (block.kind === 'heading') return true
  if (plainText.endsWith(':')) return true
  if (
    (block.kind === 'paragraph' || block.kind === 'list' || block.kind === 'blockquote') &&
    plainText.length <= SHORT_BRIDGE_BLOCK_CHARS
  ) {
    return true
  }
  return false
}

function isSubstantiveBlock(block: AskAiBlock): boolean {
  if (['code', 'multi-code', 'playground', 'mermaid', 'table'].includes(block.kind)) return true

  const plainText = normalizeText(block.plainText || block.markdown)
  if (plainText.length > SHORT_BRIDGE_BLOCK_CHARS) return true
  if ((block.kind === 'list' || block.kind === 'blockquote') && plainText.split('\n').length > 1)
    return true
  return false
}

export function collectBeforeContextBlocks(
  blocks: AskAiBlock[],
  firstSelectedIndex: number,
  maxChars: number
): AskAiBlock[] {
  const selected: AskAiBlock[] = []
  let totalChars = 0
  let foundSubstantive = false

  for (let index = firstSelectedIndex - 1; index >= 0; index -= 1) {
    const block = blocks[index]
    if (foundSubstantive && block.kind === 'heading') break
    if (selected.length >= CONTEXT_SIDE_MAX_BLOCKS) break

    const textLength = promptBlockLength(block)
    const wouldExceed = totalChars + sectionSeparatorLength(selected) + textLength > maxChars
    const substantive = isSubstantiveBlock(block)
    const bridge = isBridgeBlock(block)

    if (wouldExceed && (foundSubstantive || (selected.length > 0 && !substantive && !bridge))) break
    if (!foundSubstantive || substantive || bridge) {
      const separatorLength = sectionSeparatorLength(selected)
      selected.unshift(block)
      totalChars += separatorLength + textLength
      foundSubstantive ||= substantive
      continue
    }

    break
  }

  return selected
}

export function collectAfterContextBlocks(
  blocks: AskAiBlock[],
  lastSelectedIndex: number,
  maxChars: number
): AskAiBlock[] {
  const selected: AskAiBlock[] = []
  let totalChars = 0
  let foundSubstantive = false

  for (let index = lastSelectedIndex + 1; index < blocks.length; index += 1) {
    const block = blocks[index]
    if (foundSubstantive && block.kind === 'heading') break
    if (selected.length >= CONTEXT_SIDE_MAX_BLOCKS) break

    const textLength = promptBlockLength(block)
    const wouldExceed = totalChars + sectionSeparatorLength(selected) + textLength > maxChars
    const substantive = isSubstantiveBlock(block)
    const bridge = isBridgeBlock(block)

    if (wouldExceed && (foundSubstantive || (selected.length > 0 && !substantive && !bridge))) break
    if (!foundSubstantive || substantive || bridge) {
      const separatorLength = sectionSeparatorLength(selected)
      selected.push(block)
      totalChars += separatorLength + textLength
      foundSubstantive ||= substantive
      continue
    }

    break
  }

  return selected
}

function promptBlockLength(block: AskAiBlock): number {
  return blockToPromptText(block).length
}

function sectionSeparatorLength(blocks: AskAiBlock[]): number {
  return blocks.length > 0 ? 2 : 0
}

function blockLabel(block: Pick<AskAiBlock, 'kind' | 'language' | 'title'>): string {
  if (block.kind === 'playground') {
    return `[Текущий Kotlin Playground code]`
  }
  if (block.kind === 'code' && block.language) {
    return `[Code: ${block.language}]`
  }
  if (block.kind === 'mermaid') {
    return '[Mermaid source]'
  }
  if (block.title) {
    return `[${block.title}]`
  }
  return ''
}

function trimPromptSections(
  context: AskAiPageContext,
  sections: {
    before: string
    current: string
    after: string
    selected: string
  },
  maxChars: number
): string {
  let next = { ...sections }
  const order: Array<{ key: keyof typeof next; min: number }> = [
    { key: 'after', min: 0 },
    { key: 'before', min: 0 },
    { key: 'current', min: 120 },
    { key: 'selected', min: 80 }
  ]

  for (const item of order) {
    if (renderPrompt(context, next).length <= maxChars) break
    while (renderPrompt(context, next).length > maxChars && next[item.key].length > item.min) {
      const currentPrompt = renderPrompt(context, next)
      const targetLength = Math.max(
        item.min,
        next[item.key].length - overflow(currentPrompt, maxChars) - 200
      )
      next = {
        ...next,
        [item.key]: trimMiddle(next[item.key], targetLength)
      }
    }
  }

  while (renderPrompt(context, next).length > maxChars && next.selected.length > 80) {
    next = {
      ...next,
      selected: trimMiddle(next.selected, Math.max(80, next.selected.length - 500))
    }
  }

  return renderPrompt(context, next)
}

function renderPrompt(
  context: AskAiPageContext,
  sections: {
    before: string
    current: string
    after: string
    selected: string
  }
): string {
  return [
    'Ты помогаешь студенту понять материал курса по конструированию ПО.',
    '',
    `Курс: ${context.courseTitle}`,
    `Описание курса: ${context.courseDescription}`,
    `Страница: ${context.pageTitle}`,
    `Описание страницы: ${context.pageDescription}`,
    '',
    'Задача: объясни выделенный фрагмент с учетом контекста. Дай практичное объяснение: смысл, связь с темой, типичные ошибки, best practices, короткий пример если он полезен.',
    '',
    '[Контекст до]',
    sections.before || '(нет)',
    '',
    '[Текущий блок]',
    sections.current || '(нет)',
    '',
    '[Контекст после]',
    sections.after || '(нет)',
    '',
    '[Выделенный фрагмент]',
    sections.selected || '(нет)'
  ].join('\n')
}

function overflow(value: string, maxChars: number): number {
  return Math.max(0, value.length - maxChars)
}

function trimMiddle(value: string, maxChars: number): string {
  const normalized = normalizeText(value)
  if (normalized.length <= maxChars) return normalized
  if (maxChars <= TRIM_MARKER.length + 20) return normalized.slice(0, maxChars)

  const side = Math.floor((maxChars - TRIM_MARKER.length) / 2)
  return `${normalized.slice(0, side).trimEnd()}${TRIM_MARKER}${normalized.slice(-side).trimStart()}`
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, '\n').trim()
}
