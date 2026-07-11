export const SUPPORTED_CODE_LANGUAGES = ['kotlin', 'csharp', 'java', 'go'] as const

export type CodeLanguage = (typeof SUPPORTED_CODE_LANGUAGES)[number]

const languageAliases = new Map<string, CodeLanguage>([
  ['kt', 'kotlin'],
  ['kts', 'kotlin'],
  ['cs', 'csharp'],
  ['c#', 'csharp'],
  ['golang', 'go']
])

export function normalizeLanguage(value: string): string {
  const raw = value.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  return languageAliases.get(raw) ?? raw
}

export function isSupportedCodeLanguage(value: string): value is CodeLanguage {
  return (SUPPORTED_CODE_LANGUAGES as readonly string[]).includes(value)
}

export function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export type ResolveDisplayLanguageInput = {
  languages: readonly string[]
  initialLanguage?: string
  authorDefaultLanguage?: string
  globalLanguage?: string | null
  authorDefaultProtected?: boolean
  localUnsupportedLanguage?: string | null
}

export function resolveDisplayLanguage(input: ResolveDisplayLanguageInput): string {
  const languages = input.languages.filter(Boolean)
  const firstLanguage = languages[0] ?? ''
  const authorDefaultCandidates = [
    input.authorDefaultLanguage ?? '',
    input.globalLanguage ?? '',
    input.initialLanguage ?? '',
    firstLanguage
  ]
  const globalCandidates = [
    input.globalLanguage ?? '',
    input.authorDefaultLanguage ?? '',
    input.initialLanguage ?? '',
    firstLanguage
  ]

  return firstAvailable(languages, [
    input.localUnsupportedLanguage ?? '',
    ...(input.authorDefaultProtected ? authorDefaultCandidates : globalCandidates)
  ])
}

export type CanUsePlaygroundInput = {
  allowPlayground: boolean
  displayLanguage: string
  playgroundFailed?: boolean
  hasKotlinCode?: boolean
}

export function canUsePlayground(input: CanUsePlaygroundInput): boolean {
  return Boolean(
    input.allowPlayground &&
    input.displayLanguage === 'kotlin' &&
    !input.playgroundFailed &&
    input.hasKotlinCode
  )
}

function firstAvailable(languages: readonly string[], candidates: readonly string[]): string {
  for (const candidate of candidates) {
    if (candidate && languages.includes(candidate)) return candidate
  }

  return languages[0] ?? ''
}
