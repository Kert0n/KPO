<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { usePlaygroundController } from '../composables/code/usePlaygroundController'

/**
 * Обёртка над официальным kotlin-playground (npm-пакет).
 *
 * Жизненный цикл простой и детерминированный:
 *  - монтирование только на клиенте (динамический import в onMounted —
 *    пакет обращается к document на уровне модуля и не переживает SSR);
 *  - целевой <code> создаётся вне вёрстки Vue, чтобы playground мог
 *    свободно подменять DOM;
 *  - размонтирование — штатный instance.destroy().
 *
 * Атрибут theme не задаётся: CodeMirror стилизуется CSS-переменными
 * --kpo-code-* (см. styles/playground.css), которые переключаются
 * классом .dark. Поэтому смена темы сайта не требует пере-инициализации.
 */

const props = withDefaults(
  defineProps<{
    code: string
    platform?: string
    askBlockId?: string
  }>(),
  {
    platform: 'java',
    askBlockId: ''
  }
)

const emit = defineEmits<{ failed: [] }>()

const host = useTemplateRef('host')
const { ready } = usePlaygroundController({
  host,
  code: () => props.code,
  platform: () => props.platform,
  askBlockId: () => props.askBlockId,
  onFailed: () => emit('failed')
})
</script>

<template>
  <div ref="host" class="kpo-playground" :class="{ 'kpo-playground--ready': ready }">
    <div v-if="!ready" class="kpo-playground__skeleton" aria-live="polite">Загрузка Kotlin Playground…</div>
  </div>
</template>
