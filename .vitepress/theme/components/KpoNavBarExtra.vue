<script setup lang="ts">
import { useData } from 'vitepress'
import VPFlyout from 'vitepress/dist/client/theme-default/components/VPFlyout.vue'
import VPSwitchAppearance from 'vitepress/dist/client/theme-default/components/VPSwitchAppearance.vue'
import AskAiProviderMenuItems from './AskAiProviderMenuItems.vue'

const { site, theme } = useData()
</script>

<template>
  <VPFlyout class="KpoNavBarExtra" label="extra navigation">
    <AskAiProviderMenuItems />

    <div
      v-if="site.appearance && site.appearance !== 'force-dark' && site.appearance !== 'force-auto'"
    >
      <div class="KpoNavBarExtra__divider" />
      <div class="KpoNavBarExtra__appearance">
        <p class="KpoNavBarExtra__label">{{ theme.darkModeSwitchLabel || 'Appearance' }}</p>
        <VPSwitchAppearance />
      </div>
    </div>
  </VPFlyout>
</template>
