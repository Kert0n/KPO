import { expect, test as baseTest } from '@playwright/test'
import { STORAGE_KEYS } from '../../../.vitepress/shared/site'

export type PlaygroundTestMode = 'off' | 'on' | 'default'
export type MermaidTestMode = 'off' | 'on'

type KpoFixtures = {
  playgroundMode: PlaygroundTestMode
  mermaidMode: MermaidTestMode
  kpoBrowserDefaults: void
}

export const test = baseTest.extend<KpoFixtures>({
  playgroundMode: ['off', { option: true }],
  mermaidMode: ['off', { option: true }],
  kpoBrowserDefaults: [
    async ({ page, playgroundMode, mermaidMode }, use) => {
      await page.addInitScript(
        ({ codeLanguageKey, playgroundKey, playground, mermaid }) => {
          localStorage.clear()
          localStorage.setItem(codeLanguageKey, 'kotlin')
          if (playground !== 'default') {
            localStorage.setItem(playgroundKey, playground === 'on' ? '1' : '0')
          }
          const applyMermaidMode = () => {
            document.documentElement?.setAttribute('data-kpo-test-mermaid', mermaid)
          }
          applyMermaidMode()
          if (!document.documentElement) {
            document.addEventListener('DOMContentLoaded', applyMermaidMode, { once: true })
          }
          if (mermaid === 'off') {
            const style = document.createElement('style')
            style.textContent = '.kpo-mermaid { display: none !important; }'
            const append = () => (document.head ?? document.documentElement)?.append(style)
            if (document.documentElement) append()
            else document.addEventListener('DOMContentLoaded', append, { once: true })
          }
        },
        {
          codeLanguageKey: STORAGE_KEYS.codeLanguage,
          playgroundKey: STORAGE_KEYS.playgroundMode,
          playground: playgroundMode,
          mermaid: mermaidMode
        }
      )
      await use()
    },
    { auto: true }
  ]
})

export { expect }
