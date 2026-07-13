<script setup lang="ts">
import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue'
import AskAiProviderMenuItems from './AskAiProviderMenuItems.vue'

withDefaults(
  defineProps<{
    screenMenu?: boolean
  }>(),
  {
    screenMenu: false
  }
)
</script>

<template>
  <div v-if="screenMenu" class="KpoAskAiProviderScreen">
    <AskAiProviderMenuItems />
  </div>

  <VPFlyout v-else class="KpoAskAiProvider" icon="vpi-sparkles" label="Спросить ИИ">
    <AskAiProviderMenuItems />
  </VPFlyout>
</template>
