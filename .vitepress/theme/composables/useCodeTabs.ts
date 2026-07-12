import { computed } from 'vue'
import { parseCsv } from '../lib/codeBlockModel'

export function useCodeTabs(options: { langs: () => string; labels: () => string }) {
  const languages = computed(() => parseCsv(options.langs()))
  const labels = computed(() => parseCsv(options.labels()))

  function labelAt(index: number): string {
    return labels.value[index] ?? languages.value[index]
  }

  function languageForKey(currentLanguage: string, key: string): string | null {
    const current = Math.max(0, languages.value.indexOf(currentLanguage))
    const moves: Record<string, number> = {
      ArrowLeft: current - 1,
      ArrowRight: current + 1,
      Home: 0,
      End: languages.value.length - 1
    }
    const next = moves[key]
    if (next === undefined || languages.value.length === 0) return null
    return languages.value[(next + languages.value.length) % languages.value.length]
  }

  return { languages, labels, labelAt, languageForKey }
}
