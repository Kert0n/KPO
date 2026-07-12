<script setup lang="ts">
import { onBeforeUnmount, onMounted, readonly, ref, useTemplateRef } from 'vue'
import { KOTLIN_VERSION } from '../../shared/kotlinTooling'
import {
  registerPlayground,
  unregisterPlayground,
  updatePlaygroundCode
} from '../lib/playgroundRegistry'
import type {
  PlaygroundLifecycle,
  PlaygroundSettlement,
  PlaygroundState
} from '../lib/playgroundLifecycle'
import { waitForPlaygroundSettlement } from '../lib/playgroundLifecycle'

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

const emit = defineEmits<{ ready: []; failed: [] }>()

const host = useTemplateRef('host')
const ready = ref(false)
const state = ref<PlaygroundState>('initializing')

let targetElement: HTMLElement | undefined
let instanceGeneration = 0
let settlement: PlaygroundSettlement | null = null
let resolveSettlement: (value: PlaygroundSettlement) => void = () => undefined
let settlementPromise = new Promise<PlaygroundSettlement>((resolve) => {
  resolveSettlement = resolve
})

const lifecycle: PlaygroundLifecycle = { state: readonly(state), whenSettled, measure }
defineExpose<{ lifecycle: PlaygroundLifecycle }>({ lifecycle })

onMounted(async () => {
  if (!host.value) return
  const generation = ++instanceGeneration
  state.value = 'initializing'

  const target = document.createElement('code')
  targetElement = target
  target.textContent = props.code
  target.setAttribute('lines', 'true')
  target.setAttribute('indent', '4')
  target.setAttribute('match-brackets', 'true')
  target.setAttribute('data-autocomplete', 'true')
  target.setAttribute('data-target-platform', props.platform)
  host.value.appendChild(target)

  try {
    const { default: createPlayground } = await import('kotlin-playground')
    await createPlayground(target, {
      version: KOTLIN_VERSION,
      onChange(code) {
        updatePlaygroundCode(props.askBlockId, code)
      },
      getInstance(instance) {
        if (generation !== instanceGeneration || !target.isConnected) {
          destroyTargetInstance(target)
          return
        }
        registerPlayground(props.askBlockId, props.code, instance)
      }
    })
    if (generation !== instanceGeneration || !target.isConnected) {
      destroyTargetInstance(target)
      settle('disposed')
      return
    }
    ready.value = true
    settle('ready')
    emit('ready')
  } catch (error) {
    if (generation !== instanceGeneration) return
    console.warn('[kotlin-playground] инициализация не удалась:', error)
    settle('error')
    emit('failed')
  }
})

onBeforeUnmount(() => {
  instanceGeneration += 1
  settle('disposed')
  destroyInstance()
  unregisterPlayground(props.askBlockId)
  targetElement = undefined
})

function whenSettled(signal: AbortSignal): Promise<PlaygroundSettlement> {
  return waitForPlaygroundSettlement(
    settlement ? Promise.resolve(settlement) : settlementPromise,
    signal
  )
}

function settle(value: PlaygroundSettlement): void {
  if (settlement) return
  settlement = value
  state.value = value
  resolveSettlement(value)
}

function measure(): { width: number; height: number } {
  const rect = host.value?.getBoundingClientRect()
  return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
}

function destroyInstance(): void {
  if (targetElement) destroyTargetInstance(targetElement)
}

function destroyTargetInstance(target: HTMLElement): void {
  ;(target as { KotlinPlayground?: { destroy: () => void } }).KotlinPlayground?.destroy()
}
</script>

<template>
  <div ref="host" class="kpo-playground" :class="{ 'kpo-playground--ready': ready }">
    <div v-if="!ready" class="kpo-playground__skeleton" aria-live="polite">
      Загрузка Kotlin Playground…
    </div>
  </div>
</template>
