import { computed, onMounted, ref, type ComputedRef, type Ref } from 'vue'
import { isSupportedCodeLanguage, resolveDisplayLanguage } from '../../lib/codeBlockModel'
import { preserveViewportAnchor } from '../../lib/viewportAnchor'

type ActiveCodeLanguageOptions = {
  root: Ref<HTMLElement | null>
  languages: ComputedRef<string[]>
  initialLanguage: () => string
  authorDefaultLanguage: () => string
  globalLanguage: Ref<string>
  setGlobalLanguage: (language: 'kotlin' | 'csharp' | 'java' | 'go') => void
}

export function useActiveCodeLanguage(options: ActiveCodeLanguageOptions) {
  const hydrated = ref(false)
  const authorDefaultReleased = ref(false)
  const localUnsupportedLanguage = ref<string | null>(null)

  const displayLanguage = computed(() =>
    resolveDisplayLanguage({
      languages: options.languages.value,
      initialLanguage: options.initialLanguage(),
      authorDefaultLanguage: options.authorDefaultLanguage(),
      globalLanguage: hydrated.value ? options.globalLanguage.value : null,
      authorDefaultProtected: Boolean(options.authorDefaultLanguage()) && !authorDefaultReleased.value,
      localUnsupportedLanguage: localUnsupportedLanguage.value
    })
  )

  onMounted(() => {
    hydrated.value = true
  })

  async function selectLanguage(language: string): Promise<void> {
    await preserveViewportAnchor(options.root.value, () => {
      authorDefaultReleased.value = true
      if (isSupportedCodeLanguage(language)) {
        localUnsupportedLanguage.value = null
        options.setGlobalLanguage(language)
      } else {
        localUnsupportedLanguage.value = language
      }
    })
  }

  return { hydrated, displayLanguage, selectLanguage }
}
