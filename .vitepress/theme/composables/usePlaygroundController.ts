import { computed, nextTick, ref, watch, type Ref } from 'vue'
import { canUsePlayground } from '../lib/codeBlockModel'
import { waitForPlaygroundInitializations } from '../lib/playgroundLifecycle'
import { preserveViewportAnchor } from '../lib/viewportAnchor'

type PlaygroundSettlement = 'ready' | 'failed' | 'disposed'

export function usePlaygroundController(options: {
  root: Ref<HTMLElement | null>
  playground: Ref<{ whenSettled: () => Promise<PlaygroundSettlement> } | null>
  mounted: Ref<boolean>
  displayLanguage: Ref<string>
  allowPlayground: () => boolean
  hasKotlin: Ref<boolean>
  kotlinCode: Ref<string>
  mode: Ref<boolean>
  setMode: (value: boolean) => void
}) {
  const failed = ref(false)
  const everShown = ref(false)
  const anchorPending = ref(false)
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
    frames = 2,
    initiatingKeyEvent?: KeyboardEvent
  ): Promise<void> {
    anchorPending.value = true
    await nextTick()
    try {
      await preserveViewportAnchor(options.root.value, mutate, {
        frames,
        settle: waitForActivePlayground,
        initiatingKeyEvent
      })
    } finally {
      anchorPending.value = false
    }
  }

  async function toggle(): Promise<void> {
    await runAnchored(() => options.setMode(!options.mode.value), 3)
  }

  function markFailed(): void {
    failed.value = true
  }

  async function waitForActivePlayground(): Promise<void> {
    await nextTick()
    await waitForPlaygroundInitializations()
    if (active.value) await options.playground.value?.whenSettled()
  }

  return {
    failed,
    everShown,
    anchorPending,
    usable,
    active,
    title,
    runAnchored,
    toggle,
    markFailed
  }
}
