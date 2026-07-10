import { ref, type Ref } from 'vue'
import {
  resolveAskAiProviderAction,
  type AskAiPageContext,
  type AskAiProviderAction,
  type AskAiProviderId
} from '../../../shared/core/askAiModel'
import type { SelectionSnapshot } from './useTextSelection'

export type PreparedAskAiAction = {
  snapshot: SelectionSnapshot
  action: AskAiProviderAction
  contextUnavailable: boolean
}

export function useAskAiActionPreparation(options: {
  provider: Ref<AskAiProviderId>
  loadPageContext: () => Promise<AskAiPageContext>
  fallbackContext: (selectedText: string) => AskAiPageContext
  currentOverride: (
    blockId: string
  ) => { kind: 'playground'; language: 'kotlin'; markdown: string } | undefined
}) {
  const preparedAction = ref<PreparedAskAiAction | null>(null)
  const prepareError = ref<unknown>(null)
  const preparing = ref(false)
  let generation = 0

  async function prepare(nextSnapshot: SelectionSnapshot): Promise<void> {
    const currentGeneration = ++generation
    preparing.value = true
    preparedAction.value = null
    prepareError.value = null
    try {
      let contextUnavailable = false
      const pageContext = await options.loadPageContext().catch(() => {
        contextUnavailable = true
        return options.fallbackContext(nextSnapshot.selectedText)
      })
      const action = resolveAskAiProviderAction(options.provider.value, {
        pageContext,
        selectedText: nextSnapshot.selectedText,
        blockIds: nextSnapshot.blockIds,
        currentOverride: options.currentOverride(nextSnapshot.playgroundBlockId)
      })
      if (currentGeneration === generation) {
        preparedAction.value = { snapshot: nextSnapshot, action, contextUnavailable }
      }
    } catch (error) {
      if (currentGeneration !== generation) return
      prepareError.value = error
      console.warn('[ask-ai] не удалось подготовить prompt:', error)
    } finally {
      if (currentGeneration === generation) preparing.value = false
    }
  }

  function clear(): void {
    generation += 1
    preparing.value = false
    preparedAction.value = null
    prepareError.value = null
  }

  return { preparedAction, prepareError, preparing, prepare, clear }
}
