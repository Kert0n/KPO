<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import {
  registerPlayground,
  unregisterPlayground,
  updatePlaygroundCode
} from '../lib/playgroundRegistry'

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

const props = withDefaults(defineProps<{
  code: string
  platform?: string
  askBlockId?: string
}>(), {
  platform: 'java',
  askBlockId: ''
})

const emit = defineEmits<{ failed: [] }>()

const host = useTemplateRef('host')
const ready = ref(false)

let targetElement: HTMLElement | undefined

onMounted(async () => {
  if (!host.value) return

  targetElement = document.createElement('code')
  targetElement.textContent = props.code
  targetElement.setAttribute('lines', 'true')
  targetElement.setAttribute('indent', '4')
  targetElement.setAttribute('match-brackets', 'true')
  targetElement.setAttribute('data-autocomplete', 'true')
  targetElement.setAttribute('data-target-platform', props.platform)
  host.value.appendChild(targetElement)

  try {
    const { default: createPlayground } = await import('kotlin-playground')
    await createPlayground(targetElement, {
      onChange(code) {
        updatePlaygroundCode(props.askBlockId, code)
      },
      getInstance(instance) {
        registerPlayground(props.askBlockId, props.code, instance)
      }
    })
    ready.value = true
  } catch (error) {
    console.warn('[kotlin-playground] инициализация не удалась:', error)
    emit('failed')
  }
})

onBeforeUnmount(() => {
  const instance = (targetElement as { KotlinPlayground?: { destroy: () => void } } | undefined)?.KotlinPlayground
  instance?.destroy()
  unregisterPlayground(props.askBlockId)
  targetElement = undefined
})
</script>

<template>
  <div ref="host" class="kpo-playground" :class="{ 'kpo-playground--ready': ready }">
    <div v-if="!ready" class="kpo-playground__skeleton" aria-live="polite">
      Загрузка Kotlin Playground…
    </div>
  </div>
</template>
