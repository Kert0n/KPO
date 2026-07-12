import { nextTick, ref } from 'vue'
import { copyPromptToClipboard } from '../lib/clipboardPrompt'

export function useClipboardFallback() {
  const manualPrompt = ref('')
  let restoreFocusTo: HTMLElement | null = null
  let requestedRestoreFocusTo: HTMLElement | null = null

  function setRestoreFocusTarget(target: HTMLElement | null): void {
    requestedRestoreFocusTo = target
  }

  async function copyPrompt(prompt: string): Promise<boolean> {
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusBeforeCopy = requestedRestoreFocusTo ?? activeElement
    requestedRestoreFocusTo = null
    const result = await copyPromptToClipboard(prompt)
    if (result.ok) return true

    restoreFocusTo = focusBeforeCopy
    manualPrompt.value = prompt
    await nextTick()
    const textarea = document.querySelector<HTMLTextAreaElement>('.kpo-ai-manual textarea')
    textarea?.select()
    return false
  }

  function handleDialogKeydown(event: KeyboardEvent): boolean {
    if (!manualPrompt.value) return false
    if (event.key === 'Escape') {
      event.preventDefault()
      closeManualPrompt()
      return true
    }
    if (event.key !== 'Tab') return false

    const dialog = document.querySelector<HTMLElement>('.kpo-ai-manual')
    const focusable = dialog
      ? [...dialog.querySelectorAll<HTMLElement>('textarea, button:not([disabled])')]
      : []
    if (focusable.length === 0) return false
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !dialog?.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !dialog?.contains(active))) {
      event.preventDefault()
      first.focus()
    }
    return true
  }

  function closeManualPrompt(): void {
    if (!manualPrompt.value) return
    manualPrompt.value = ''
    const target = restoreFocusTo
    restoreFocusTo = null
    void nextTick(() => {
      if (target?.isConnected) target.focus()
    })
  }

  function dispose(): void {
    manualPrompt.value = ''
    restoreFocusTo = null
    requestedRestoreFocusTo = null
  }

  return {
    manualPrompt,
    copyPrompt,
    closeManualPrompt,
    handleDialogKeydown,
    setRestoreFocusTarget,
    dispose
  }
}
