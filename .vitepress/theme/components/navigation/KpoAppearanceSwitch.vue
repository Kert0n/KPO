<script setup lang="ts">
import { useData } from 'vitepress'

const { isDark } = useData()
</script>

<template>
  <button
    class="VPSwitch VPSwitchAppearance kpo-appearance-switch"
    type="button"
    role="switch"
    :aria-checked="isDark"
    aria-label="Переключить тему"
    @click="isDark = !isDark"
  >
    <span class="check">
      <span class="icon"><span class="vpi-sun sun" /><span class="vpi-moon moon" /></span>
    </span>
  </button>
</template>

<style scoped>
.kpo-appearance-switch {
  position: relative;
  display: block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  border: 1px solid var(--vp-input-border-color);
  border-radius: 11px;
  background-color: var(--vp-input-switch-bg-color);
  transition: border-color 0.25s !important;
}

.kpo-appearance-switch:hover {
  border-color: var(--vp-c-brand-1);
}

.check {
  position: absolute;
  top: 1px;
  left: 1px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--vp-c-neutral-inverse);
  box-shadow: var(--vp-shadow-1);
  transition: transform 0.25s !important;
}

.icon {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
  overflow: hidden;
  border-radius: 50%;
}

.icon :deep([class^='vpi-']) {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  color: var(--vp-c-text-2);
  transition: opacity 0.25s !important;
}

.sun {
  opacity: 1;
}

.moon {
  opacity: 0;
}

:global(.dark) .sun {
  opacity: 0;
}

:global(.dark) .moon {
  opacity: 1;
}

:global(.dark) .check {
  transform: translateX(18px);
}
</style>
