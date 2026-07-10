<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

withDefaults(defineProps<{ label: string; icon?: string }>(), { icon: '' })

const root = useTemplateRef('root')
const button = useTemplateRef('button')
const open = ref(false)

function show(): void {
  open.value = true
}

function hide(): void {
  open.value = false
}

function toggle(): void {
  open.value = !open.value
}

function onFocusOut(): void {
  void nextTick(() => {
    if (!root.value?.contains(document.activeElement)) hide()
  })
}

function onDocumentPointerDown(event: PointerEvent): void {
  if (event.target instanceof Node && !root.value?.contains(event.target)) hide()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !open.value) return
  hide()
  button.value?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div
    ref="root"
    class="VPFlyout kpo-flyout"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="onFocusOut"
  >
    <button
      ref="button"
      type="button"
      class="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="label"
      @click="toggle"
    >
      <span class="text">
        <span v-if="icon" class="option-icon" :class="icon" />
        <span v-else>{{ label }}</span>
        <span class="vpi-chevron-down text-icon" aria-hidden="true" />
      </span>
    </button>
    <div v-show="open" class="menu">
      <div class="VPMenu kpo-flyout__menu" role="menu">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.kpo-flyout {
  position: relative;
}

.kpo-flyout:hover {
  color: var(--vp-c-brand-1);
  transition: color 0.25s;
}

.button {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: var(--vp-nav-height);
  color: var(--vp-c-text-1);
  transition: color 0.5s;
}

.text {
  display: flex;
  align-items: center;
  line-height: var(--vp-nav-height);
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  transition: color 0.25s;
}

.kpo-flyout:hover .text {
  color: var(--vp-c-text-2);
}

.option-icon {
  margin-right: 0;
  font-size: 16px;
}

.text-icon {
  margin-left: 4px;
  font-size: 14px;
}

.menu {
  position: absolute;
  top: calc(var(--vp-nav-height) / 2 + 20px);
  right: 0;
  z-index: 1;
}

.kpo-flyout__menu {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 12px;
  min-width: 128px;
  max-height: calc(100vh - var(--vp-nav-height));
  overflow-y: auto;
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-3);
  transition: background-color 0.5s;
}
</style>
