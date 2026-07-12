import { useRoute } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { canUsePlayground } from '../lib/codeBlockModel'
import type { PlaygroundLifecycle } from '../lib/playgroundLifecycle'
import { preserveViewportAnchor } from '../lib/viewportAnchor'

export function usePlaygroundController(options: {
  root: Ref<HTMLElement | null>
  playground: Ref<{ lifecycle: PlaygroundLifecycle } | null>
  mounted: Ref<boolean>
  displayLanguage: Ref<string>
  allowPlayground: () => boolean
  hasKotlin: Ref<boolean>
  kotlinCode: Ref<string>
  mode: Ref<boolean>
  setMode: (value: boolean) => void
}) {
  const route = useRoute()
  const failed = ref(false)
  const everShown = ref(false)
  let transaction: AbortController | null = null
  let applyingOwnedMutation = false
  const usable = computed(() => {
    return (
      options.mounted.value &&
      canUsePlayground({
        allowPlayground: options.allowPlayground(),
        displayLanguage: options.displayLanguage.value,
        playgroundFailed: failed.value,
        hasKotlinCode: options.kotlinCode.value !== ''
      })
    )
  })
  const active = computed(() => {
    return (
      options.mounted.value && usable.value && options.mode.value && options.kotlinCode.value !== ''
    )
  })
  const title = computed(() => {
    if (options.displayLanguage.value !== 'kotlin') return 'Playground доступен для Kotlin'
    if (failed.value) return 'Playground недоступен'
    return options.mode.value ? 'Выключить интерактивный режим' : 'Включить интерактивный режим'
  })

  watch(
    active,
    (value) => {
      if (value) everShown.value = true
    },
    { immediate: true }
  )

  async function runAnchored(
    mutate: () => void,
    initiatingKeyEvent?: KeyboardEvent
  ): Promise<void> {
    cancelTransaction('new code-switcher action')
    const controller = new AbortController()
    transaction = controller
    await nextTick()
    try {
      await preserveViewportAnchor(
        options.root.value,
        () => {
          applyingOwnedMutation = true
          try {
            mutate()
          } finally {
            applyingOwnedMutation = false
          }
        },
        {
          settle: (signal) => waitForActivePlayground(signal, controller),
          signal: controller.signal,
          initiatingKeyEvent
        }
      )
    } finally {
      if (transaction === controller) {
        transaction = null
      }
    }
  }

  async function toggle(): Promise<void> {
    await runAnchored(() => options.setMode(!options.mode.value))
  }

  function markFailed(): void {
    failed.value = true
    cancelTransaction('playground error')
  }

  async function waitForActivePlayground(
    signal: AbortSignal,
    controller: AbortController
  ): Promise<void> {
    await nextTick()
    if (!active.value || signal.aborted) return
    const lifecycle = options.playground.value?.lifecycle
    if (!lifecycle) {
      controller.abort('missing scoped Playground lifecycle')
      return
    }
    const settlement = await lifecycle.whenSettled(signal)
    if (settlement === 'ready') return
    if (settlement === 'error') failed.value = true
    controller.abort(`playground ${settlement}`)
  }

  function cancelTransaction(reason: string): void {
    transaction?.abort(reason)
    transaction = null
  }

  watch(
    () => route.path,
    () => cancelTransaction('route change')
  )

  watch(
    [options.displayLanguage, options.mode],
    () => {
      if (!applyingOwnedMutation) cancelTransaction('external code-switcher state change')
    },
    { flush: 'sync' }
  )

  onBeforeUnmount(() => cancelTransaction('code switcher unmount'))

  return {
    failed,
    everShown,
    usable,
    active,
    title,
    runAnchored,
    toggle,
    markFailed
  }
}
