import type { ComputedRef } from 'vue'

export function useCodeTabs(
  languages: ComputedRef<string[]>,
  displayLanguage: ComputedRef<string>,
  selectLanguage: (language: string) => Promise<void>
) {
  function onTabsKeydown(event: KeyboardEvent): void {
    const values = languages.value
    const current = Math.max(0, values.indexOf(displayLanguage.value))
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: values.length - 1
    }
    const next = moves[event.key]
    if (next === undefined || values.length === 0) return
    event.preventDefault()
    void selectLanguage(values[(next + values.length) % values.length])
  }

  return { onTabsKeydown }
}
