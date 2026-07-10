import { onMounted, watch, type ComputedRef, type Ref } from 'vue'

export function useShikiBlocks(blocksElement: Ref<HTMLElement | null>, displayLanguage: ComputedRef<string>) {
  function syncActiveBlock(): void {
    const blocks = blocksElement.value?.querySelectorAll(':scope > [class*="language-"]') ?? []
    for (const block of blocks) {
      block.classList.toggle('active', blockLanguage(block) === displayLanguage.value)
    }
  }

  function extractKotlinCode(): string {
    const code = blocksElement.value?.querySelector(':scope > .language-kotlin pre code')
    return code?.textContent?.replace(/\n$/, '') ?? ''
  }

  onMounted(syncActiveBlock)
  watch(displayLanguage, syncActiveBlock)

  return { extractKotlinCode, syncActiveBlock }
}

function blockLanguage(block: Element): string {
  for (const name of block.classList) {
    if (name.startsWith('language-')) return name.slice('language-'.length)
  }
  return ''
}
