<script setup lang="ts">
import { usePlayground } from '../composables/usePlayground'
import { useCodeLanguage } from '../composables/useCodeLanguage'

const { playgroundEnabled, label, toggle } = usePlayground()
const { playgroundToggleVisible } = useCodeLanguage()
</script>

<template>
  <button
    v-if="playgroundToggleVisible"
    class="playground-toggle"
    type="button"
    :aria-pressed="playgroundEnabled"
    :title="label"
    @click="toggle"
  >
    <span class="playground-toggle__track">
      <span class="playground-toggle__thumb" />
    </span>
    <span class="playground-toggle__text">Playground</span>
  </button>
</template>

<style scoped>
.playground-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 8px;
  border: 0;
  color: var(--vp-c-text-2);
  background: transparent;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
}

.playground-toggle:hover {
  color: var(--vp-c-text-1);
}

.playground-toggle:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
  border-radius: 6px;
}

.playground-toggle__track {
  position: relative;
  width: 34px;
  height: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--kpo-control-bg);
  transition: background 160ms ease, border-color 160ms ease;
}

.playground-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--vp-c-text-2);
  transition: transform 160ms ease, background 160ms ease;
}

.playground-toggle[aria-pressed='true'] .playground-toggle__track {
  border-color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 24%, var(--kpo-control-bg));
}

.playground-toggle[aria-pressed='true'] .playground-toggle__thumb {
  transform: translateX(14px);
  background: var(--vp-c-brand-1);
}

@media (max-width: 768px) {
  .playground-toggle__text {
    display: none;
  }
}
</style>
