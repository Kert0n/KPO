export type SiteIdentity = {
  title: string
  description: string
  origin: string
  base: string
  language: string
  kotlinVersion: string
}

export const SITE: SiteIdentity = {
  title: 'Конструирование ПО',
  description: 'Конспект лекций по архитектуре приложений и инженерным практикам',
  origin: 'https://kert0n.github.io',
  base: '/KPO/',
  language: 'ru-RU',
  kotlinVersion: '2.4.0'
}

export const STORAGE_KEYS = {
  askAiProvider: 'kpo:ask-ai-provider',
  codeLanguage: 'kpo:code-language',
  playgroundMode: 'kpo:playground-mode'
} as const

export function siteUrl(path = '/'): string {
  return new URL(path.replace(/^\//, ''), `${SITE.origin}${SITE.base}`).toString()
}
