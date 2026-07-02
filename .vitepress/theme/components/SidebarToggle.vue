<script setup lang="ts">
import { useSidebarVisibility } from '../composables/useSidebarVisibility'

const { sidebarHidden, setSidebarHidden } = useSidebarVisibility()

function toggleSidebar(event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  setSidebarHidden(!sidebarHidden.value)
}
</script>

<template>
  <button
    type="button"
    class="kpo-sidebar-toggle"
    :aria-pressed="!sidebarHidden"
    :title="sidebarHidden ? 'Показать боковую панель' : 'Скрыть боковую панель'"
    aria-label="Боковая панель"
    @click="toggleSidebar"
  >
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="11" rx="2" fill="none" stroke="currentColor" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" stroke="currentColor" />
    </svg>
  </button>
</template>

<!-- Стили — в styles/layout.css: позиционирование кнопки зависит
     от глобального состояния html.kpo-sidebar-hidden -->
