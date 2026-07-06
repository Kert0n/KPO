<script setup lang="ts">
import { computed } from 'vue'
import { useAskAiProvider } from '../composables/useAskAiProvider'
import {
  ASK_AI_PROVIDERS,
  isAskAiProviderId
} from '../lib/askAiModel'

const props = withDefaults(defineProps<{
  screenMenu?: boolean
}>(), {
  screenMenu: false
})

const { askAiProvider, setAskAiProvider } = useAskAiProvider()

const label = computed(() => {
  return ASK_AI_PROVIDERS.find((provider) => provider.id === askAiProvider.value)?.label ?? 'ChatGPT'
})

function onChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (isAskAiProviderId(value)) setAskAiProvider(value)
}
</script>

<template>
  <div class="kpo-ai-provider" :class="{ 'kpo-ai-provider--screen': screenMenu }">
    <label v-if="screenMenu" class="kpo-ai-provider__screen-label" for="kpo-ai-provider-screen">
      Ask AI
    </label>

    <label v-else class="kpo-ai-provider__desktop-label" for="kpo-ai-provider-desktop">
      <span aria-hidden="true">AI</span>
      <span class="visually-hidden">Ask AI provider</span>
    </label>

    <select
      :id="screenMenu ? 'kpo-ai-provider-screen' : 'kpo-ai-provider-desktop'"
      class="kpo-ai-provider__select"
      :value="askAiProvider"
      :aria-label="screenMenu ? undefined : `Ask AI provider: ${label}`"
      @change="onChange"
    >
      <option
        v-for="provider in ASK_AI_PROVIDERS"
        :key="provider.id"
        :value="provider.id"
      >
        {{ provider.label }}
      </option>
    </select>
  </div>
</template>
