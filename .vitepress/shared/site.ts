export type SiteIdentity = {
  title: string
  shortTitle: string
  description: string
  origin: string
  base: string
  language: string
  kotlinVersion: string
  storageKeys: {
    codeLanguage: string
    playgroundMode: string
    askAiProvider: string
    appearance: string
  }
  askAiContextBasePath: string
}

export const SITE: SiteIdentity = {
  title: 'Конструирование ПО',
  shortTitle: 'КПО',
  description: 'Конспект лекций по архитектуре приложений и инженерным практикам',
  origin: 'https://kert0n.github.io',
  base: '/KPO/',
  language: 'ru-RU',
  kotlinVersion: '2.4.0',
  storageKeys: {
    codeLanguage: 'kpo:code-language',
    playgroundMode: 'kpo:playground-mode',
    askAiProvider: 'kpo:ask-ai-provider',
    appearance: 'vitepress-theme-appearance'
  },
  askAiContextBasePath: '/__ask-ai-context/'
}

export function siteUrl(route = '/'): string {
  const baseUrl = new URL(SITE.base, SITE.origin)
  return new URL(route.replace(/^\//, ''), baseUrl).toString()
}
