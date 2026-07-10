import { nextTick, ref, watch } from 'vue'
import { copyPromptToClipboard } from '../../lib/clipboardPrompt'

export function useClipboardFallback(restoreFocus: () => void) {
  const manualPrompt = ref('')
  const manualPanel = ref<HTMLElement | null>(null)

  async function copyPrompt(prompt: string): Promise<boolean> {
    const result = await copyPromptToClipboard(prompt)
    if (result.ok) return true
    manualPrompt.value = prompt
    return false
  }

  function closeManualPrompt(): void {
    manualPrompt.value = ''
  }

  function trapManualDialogFocus(event: KeyboardEvent): void {
    const focusable = [
      ...(manualPanel.value?.querySelectorAll<HTMLElement>('textarea, button') ?? [])
    ].filter((element) => !element.hasAttribute('disabled'))
    if (focusable.length === 0) return
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? focusable.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex === focusable.length - 1
        ? 0
        : currentIndex + 1
    event.preventDefault()
    focusable[nextIndex].focus()
  }

  watch(manualPrompt, async (value, previous) => {
    await nextTick()
    if (value && !previous) {
      const textarea = manualPanel.value?.querySelector<HTMLTextAreaElement>('textarea')
      textarea?.focus()
      textarea?.select()
    } else if (!value && previous) {
      restoreFocus()
    }
  })

  return { manualPrompt, manualPanel, copyPrompt, closeManualPrompt, trapManualDialogFocus }
}
