import { computed, ref, type Ref } from 'vue'
import { isSupportedCodeLanguage, resolveDisplayLanguage } from '../lib/codeBlockModel'

export function useActiveCodeLanguage(options: {
  languages: Ref<string[]>
  initialLanguage: () => string
  authorDefaultLanguage: () => string
  mounted: Ref<boolean>
  globalLanguage: Ref<string>
  setGlobalLanguage: (language: 'kotlin' | 'csharp' | 'java' | 'go') => void
}) {
  const authorDefaultReleased = ref(false)
  const localUnsupportedLanguage = ref<string | null>(null)
  const displayLanguage = computed(() => {
    const authorDefault = options.authorDefaultLanguage()
    return resolveDisplayLanguage({
      languages: options.languages.value,
      initialLanguage: options.initialLanguage(),
      authorDefaultLanguage: authorDefault,
      globalLanguage: options.mounted.value ? options.globalLanguage.value : null,
      authorDefaultProtected: Boolean(authorDefault) && !authorDefaultReleased.value,
      localUnsupportedLanguage: localUnsupportedLanguage.value
    })
  })

  function select(language: string): void {
    authorDefaultReleased.value = true
    if (isSupportedCodeLanguage(language)) {
      localUnsupportedLanguage.value = null
      options.setGlobalLanguage(language)
    } else {
      localUnsupportedLanguage.value = language
    }
  }

  return { displayLanguage, select }
}
