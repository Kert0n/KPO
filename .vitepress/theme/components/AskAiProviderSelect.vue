<script setup lang="ts">
import AskAiProviderMenuItems from './AskAiProviderMenuItems.vue'
import KpoFlyout from './navigation/KpoFlyout.vue'

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

  <KpoFlyout v-else class="KpoAskAiProvider" icon="vpi-sparkles" label="Спросить ИИ">
    <AskAiProviderMenuItems />
  </KpoFlyout>
</template>
