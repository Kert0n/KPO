import { ref, watch, type Ref } from 'vue'

export function useShikiBlocks(options: {
  blocks: Ref<HTMLElement | null>
  displayLanguage: Ref<string>
  encodedPlaygroundCode: () => string
  tabId: (language: string) => string
  panelId: (language: string) => string
}) {
  const kotlinCode = ref('')

  watch(options.displayLanguage, syncActiveBlock)

  function initialize(hasKotlin: boolean): void {
    if (!hasKotlin) return
    kotlinCode.value = decodePlaygroundCode()
    syncActiveBlock()
  }

  function syncActiveBlock(): void {
    const blocks = options.blocks.value?.querySelectorAll(':scope > [class*="language-"]') ?? []
    for (const block of blocks) {
      const language = blockLanguage(block)
      const active = language === options.displayLanguage.value
      block.classList.toggle('active', active)
      block.setAttribute('id', options.panelId(language))
      block.setAttribute('role', 'tabpanel')
      block.setAttribute('aria-labelledby', options.tabId(language))
      block.setAttribute('aria-hidden', String(!active))
    }
  }

  function decodePlaygroundCode(): string {
    const encoded = options.encodedPlaygroundCode()
    if (!encoded) return ''
    try {
      return decodeURIComponent(encoded).replace(/\n$/, '')
    } catch {
      return encoded.replace(/\n$/, '')
    }
  }

  return { kotlinCode, initialize, syncActiveBlock }
}

function blockLanguage(block: Element): string {
  for (const name of block.classList) {
    if (name.startsWith('language-')) return name.slice('language-'.length)
  }
  return ''
}
