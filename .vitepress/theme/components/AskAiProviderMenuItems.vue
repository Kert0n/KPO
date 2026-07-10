<script setup lang="ts">
import { useAskAiProvider } from '../composables/useAskAiProvider'
import { isAskAiProviderId, type AskAiProviderId } from '../../shared/core/askAiModel'

const { askAiProvider, setAskAiProvider } = useAskAiProvider()

const providerMenuItems: Array<{
  id: AskAiProviderId
  label: string
  separated?: boolean
}> = [
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'clipboard', label: 'Копировать промпт', separated: true }
]

function selectProvider(value: string): void {
  if (!isAskAiProviderId(value)) return
  setAskAiProvider(value)
}
</script>

<template>
  <div class="KpoAskAiProviderMenu" role="radiogroup" aria-label="Провайдер Ask AI">
    <p class="KpoAskAiProviderMenu__title">СПРОСИТЬ ИИ</p>
    <template v-for="provider in providerMenuItems" :key="provider.id">
      <div v-if="provider.separated" class="KpoAskAiProviderMenu__divider" />
      <button
        type="button"
        class="KpoAskAiProviderMenu__item"
        role="radio"
        :aria-checked="askAiProvider === provider.id"
        @click="selectProvider(provider.id)"
      >
        <span>{{ provider.label }}</span>
        <span v-if="askAiProvider === provider.id" class="KpoAskAiProviderMenu__check" aria-hidden="true">
          ✓
        </span>
      </button>
    </template>
  </div>
</template>
