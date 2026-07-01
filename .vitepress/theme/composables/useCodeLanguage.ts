import { computed, onMounted, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'

export type CodeLanguage = 'kotlin' | 'csharp' | 'java' | 'go'

const storageKey = 'kpo:code-language'
const supportedLanguages: CodeLanguage[] = ['kotlin', 'csharp', 'java', 'go']
const activeLanguage = ref<CodeLanguage>('kotlin')
const playableKotlinSwitcherCount = ref(0)
let initialized = false

type CodeLanguageApi = {
  activeLanguage: Ref<CodeLanguage>
  activeLanguageIsKotlin: ComputedRef<boolean>
  playableKotlinSwitcherCount: Ref<number>
  playgroundToggleVisible: ComputedRef<boolean>
  setActiveLanguage: (language: CodeLanguage) => void
  resolveLanguage: (defaultLanguage: CodeLanguage, available: CodeLanguage[]) => CodeLanguage
  registerPlayableKotlinSwitcher: () => void
  unregisterPlayableKotlinSwitcher: () => void
}

export function useCodeLanguage(): CodeLanguageApi {
  onMounted(() => {
    initialize()
    window.addEventListener('storage', onStorage)
  })

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  })

  const activeLanguageIsKotlin = computed(() => activeLanguage.value === 'kotlin')
  const playgroundToggleVisible = computed(() => {
    return activeLanguageIsKotlin.value && playableKotlinSwitcherCount.value > 0
  })

  function setActiveLanguage(language: CodeLanguage): void {
    if (!isCodeLanguage(language)) return

    activeLanguage.value = language

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, language)
    }
  }

  function resolveLanguage(defaultLanguage: CodeLanguage, available: CodeLanguage[]): CodeLanguage {
    if (available.includes(activeLanguage.value)) return activeLanguage.value
    if (available.includes(defaultLanguage)) return defaultLanguage
    return available[0] ?? 'kotlin'
  }

  function registerPlayableKotlinSwitcher(): void {
    playableKotlinSwitcherCount.value += 1
  }

  function unregisterPlayableKotlinSwitcher(): void {
    playableKotlinSwitcherCount.value = Math.max(0, playableKotlinSwitcherCount.value - 1)
  }

  return {
    activeLanguage,
    activeLanguageIsKotlin,
    playableKotlinSwitcherCount,
    playgroundToggleVisible,
    setActiveLanguage,
    resolveLanguage,
    registerPlayableKotlinSwitcher,
    unregisterPlayableKotlinSwitcher
  }
}

function initialize(): void {
  if (initialized || typeof window === 'undefined') return

  initialized = true
  const storedLanguage = window.localStorage.getItem(storageKey)
  if (isCodeLanguage(storedLanguage)) {
    activeLanguage.value = storedLanguage
  }
}

function onStorage(event: StorageEvent): void {
  if (event.key !== storageKey) return
  if (isCodeLanguage(event.newValue)) {
    activeLanguage.value = event.newValue
  }
}

function isCodeLanguage(value: unknown): value is CodeLanguage {
  return typeof value === 'string' && supportedLanguages.includes(value as CodeLanguage)
}
