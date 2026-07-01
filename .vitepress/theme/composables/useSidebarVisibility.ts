import { computed, onMounted, ref } from 'vue'

const storageKey = 'kpo:sidebar-hidden'
const sidebarHidden = ref(false)
let initialized = false

export function useSidebarVisibility() {
  onMounted(initialize)

  const label = computed(() => sidebarHidden.value ? 'Показать сайдбар' : 'Скрыть сайдбар')

  function toggle(): void {
    setSidebarHidden(!sidebarHidden.value)
  }

  function setSidebarHidden(value: boolean): void {
    sidebarHidden.value = value

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, value ? '1' : '0')
      applySidebarState(value)
    }
  }

  return {
    sidebarHidden,
    label,
    toggle,
    setSidebarHidden
  }
}

function initialize(): void {
  if (initialized || typeof window === 'undefined') return

  initialized = true
  sidebarHidden.value = window.localStorage.getItem(storageKey) === '1'
  applySidebarState(sidebarHidden.value)
}

function applySidebarState(value: boolean): void {
  document.documentElement.classList.toggle('kpo-sidebar-hidden', value)
}
