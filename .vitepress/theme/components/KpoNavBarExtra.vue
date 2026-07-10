<script setup lang="ts">
import { useData } from 'vitepress'
import AskAiProviderMenuItems from './AskAiProviderMenuItems.vue'
import KpoAppearanceSwitch from './navigation/KpoAppearanceSwitch.vue'
import KpoFlyout from './navigation/KpoFlyout.vue'

const { site, theme } = useData()
</script>

<template>
  <KpoFlyout class="KpoNavBarExtra" label="extra navigation">
    <AskAiProviderMenuItems />

    <div v-if="site.appearance && site.appearance !== 'force-dark' && site.appearance !== 'force-auto'">
      <div class="KpoNavBarExtra__divider" />
      <div class="KpoNavBarExtra__appearance">
        <p class="KpoNavBarExtra__label">{{ theme.darkModeSwitchLabel || 'Appearance' }}</p>
        <KpoAppearanceSwitch />
      </div>
    </div>
  </KpoFlyout>
</template>
