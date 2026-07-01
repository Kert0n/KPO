<script setup lang="ts">
import { useSidebarVisibility } from '../composables/useSidebarVisibility'

const { sidebarHidden, label, toggle } = useSidebarVisibility()

function activate(event: Event) {
  event.preventDefault()
  event.stopPropagation()

  if (typeof window !== 'undefined' && !window.matchMedia('(min-width: 960px)').matches) {
    const localMenu = document.querySelector<HTMLButtonElement>('.VPLocalNav .menu')

    if (localMenu) {
      localMenu.click()
      return
    }
  }

  toggle()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    activate(event)
  }
}
</script>

<template>
  <span
    class="sidebar-toggle"
    role="button"
    tabindex="0"
    aria-label="Сайдбар"
    :aria-pressed="sidebarHidden"
    :title="label"
    @click="activate"
    @keydown="handleKeydown"
  >
    <span class="sidebar-toggle__icon" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
    <span class="sidebar-toggle__text">Сайдбар</span>
  </span>
</template>

<style scoped>
.sidebar-toggle {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  height: 2rem;
  margin-inline-start: 0.75rem;
  padding: 0 0.625rem;
  border: 1px solid var(--kpo-nav-border);
  border-radius: 0.5rem;
  color: var(--vp-c-text-2);
  background: var(--kpo-control-bg);
  font-size: 0.75rem;
  font-weight: 650;
  line-height: 1;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  user-select: none;
}

.sidebar-toggle:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand-1);
}

.sidebar-toggle:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.sidebar-toggle[aria-pressed='true'] {
  color: var(--vp-c-brand-1);
  background: var(--kpo-control-active);
}

.sidebar-toggle__icon {
  display: grid;
  gap: 0.1875rem;
  width: 0.9375rem;
}

.sidebar-toggle__icon span {
  display: block;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

@media (max-width: 959px) {
  .sidebar-toggle {
    height: 1.875rem;
    margin-inline-start: 0.5rem;
    padding-inline: 0.5rem;
  }

  .sidebar-toggle__text {
    display: none;
  }
}
</style>
