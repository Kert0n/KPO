import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { SITE } from '../../../shared/site'
import { registerPlayground, unregisterPlayground, updatePlaygroundCode } from '../../lib/playgroundRegistry'

type PlaygroundControllerOptions = {
  host: Ref<HTMLElement | null>
  code: () => string
  platform: () => string
  askBlockId: () => string
  onFailed: () => void
}

export function usePlaygroundController(options: PlaygroundControllerOptions) {
  const ready = ref(false)
  let targetElement: HTMLElement | undefined
  let disposed = false

  onMounted(async () => {
    if (!options.host.value) return
    disposed = false
    targetElement = createTarget(options.code(), options.platform())
    options.host.value.appendChild(targetElement)

    try {
      const { default: createPlayground } = await import('kotlin-playground')
      if (disposed || !targetElement?.isConnected) return
      await createPlayground(targetElement, {
        onChange(code) {
          if (!disposed) updatePlaygroundCode(options.askBlockId(), code)
        },
        getInstance(instance) {
          if (disposed) instance.KotlinPlayground?.destroy?.()
          else registerPlayground(options.askBlockId(), options.code(), instance)
        }
      })
      if (disposed || !targetElement?.isConnected) {
        playgroundInstance(targetElement)?.destroy?.()
        return
      }
      for (const textarea of options.host.value?.querySelectorAll<HTMLTextAreaElement>(
        '.CodeMirror textarea'
      ) ?? []) {
        textarea.setAttribute('aria-label', 'Редактор Kotlin Playground')
      }
      ready.value = true
    } catch (error) {
      if (disposed) return
      console.warn('[kotlin-playground] инициализация не удалась:', error)
      options.onFailed()
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    playgroundInstance(targetElement)?.destroy?.()
    unregisterPlayground(options.askBlockId())
    targetElement = undefined
  })

  return { ready }
}

function createTarget(code: string, platform: string): HTMLElement {
  const target = document.createElement('code')
  target.textContent = code
  target.setAttribute('lines', 'true')
  target.setAttribute('indent', '4')
  target.setAttribute('match-brackets', 'true')
  target.setAttribute('data-autocomplete', 'true')
  target.setAttribute('data-target-platform', platform)
  target.setAttribute('data-version', SITE.kotlinVersion)
  return target
}

function playgroundInstance(element: HTMLElement | undefined): { destroy?: () => void } | undefined {
  return (element as { KotlinPlayground?: { destroy?: () => void } } | undefined)?.KotlinPlayground
}
