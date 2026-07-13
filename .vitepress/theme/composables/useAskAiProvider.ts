import type { Ref } from 'vue'
import { isAskAiProviderId, type AskAiProviderId } from '../lib/askAiModel'
import { createPersistentState } from './persistentState'
import { SITE } from '../../shared/site'

const provider = createPersistentState<AskAiProviderId>({
  key: SITE.storageKeys.askAiProvider,
  initial: 'chatgpt',
  encode: (value) => value,
  decode: (raw) => raw as AskAiProviderId,
  validate: isAskAiProviderId
})

export function useAskAiProvider(): {
  askAiProvider: Ref<AskAiProviderId>
  setAskAiProvider: (value: AskAiProviderId) => void
} {
  provider.setupOnMounted()

  return {
    askAiProvider: provider.state,
    setAskAiProvider: provider.set
  }
}
