import { computed, onMounted, ref } from 'vue'

const storageKey = 'kpo:kotlin-playground-enabled'
const playgroundEnabled = ref(true)
let initialized = false

export function usePlayground() {
  onMounted(initialize)

  const label = computed(() => playgroundEnabled.value ? 'Playground включен' : 'Playground выключен')

  function toggle(): void {
    setPlaygroundEnabled(!playgroundEnabled.value)
  }

  function setPlaygroundEnabled(value: boolean): void {
    playgroundEnabled.value = value

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, value ? '1' : '0')
    }
  }

  return {
    playgroundEnabled,
    label,
    toggle,
    setPlaygroundEnabled
  }
}

function initialize(): void {
  if (initialized || typeof window === 'undefined') return

  initialized = true
  playgroundEnabled.value = window.localStorage.getItem(storageKey) !== '0'
}
