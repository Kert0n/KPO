<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { KOTLIN_VERSION } from '../../shared/kotlinTooling'
import {
  registerPlayground,
  unregisterPlayground,
  updatePlaygroundCode
} from '../lib/playgroundRegistry'
import {
  beginPlaygroundInitialization,
  type PlaygroundInitialization
} from '../lib/playgroundLifecycle'

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

type PlaygroundSettlement = 'ready' | 'failed' | 'disposed'

const emit = defineEmits<{ ready: []; failed: [] }>()

const host = useTemplateRef('host')
const ready = ref(false)

let targetElement: HTMLElement | undefined
let instanceGeneration = 0
let initialization: PlaygroundInitialization | null = null
let settlement: PlaygroundSettlement | null = null
let resolveSettlement: (value: PlaygroundSettlement) => void = () => undefined
let settlementPromise = new Promise<PlaygroundSettlement>((resolve) => {
  resolveSettlement = resolve
})

defineExpose({ whenSettled })

onMounted(async () => {
  if (!host.value) return
  const generation = ++instanceGeneration
  initialization = beginPlaygroundInitialization()

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
    await waitForHostLayoutStable(host.value, generation)
    if (generation !== instanceGeneration || !target.isConnected) {
      settle('disposed')
      return
    }
    settle('ready')
    emit('ready')
  } catch (error) {
    if (generation !== instanceGeneration) return
    console.warn('[kotlin-playground] инициализация не удалась:', error)
    settle('failed')
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

function whenSettled(): Promise<PlaygroundSettlement> {
  return settlement ? Promise.resolve(settlement) : settlementPromise
}

function settle(value: PlaygroundSettlement): void {
  if (settlement) return
  settlement = value
  initialization?.settle()
  initialization = null
  resolveSettlement(value)
}

function destroyInstance(): void {
  if (targetElement) destroyTargetInstance(targetElement)
}

function destroyTargetInstance(target: HTMLElement): void {
  ;(target as { KotlinPlayground?: { destroy: () => void } }).KotlinPlayground?.destroy()
}

async function waitForHostLayoutStable(element: HTMLElement, generation: number): Promise<void> {
  const stableFramesRequired = 8
  const emergencyTimeoutMs = 10_000
  const startedAt = performance.now()
  let changed = true
  let stableFrames = 0
  let previousWidth = element.getBoundingClientRect().width
  let previousHeight = element.getBoundingClientRect().height
  const observer = new ResizeObserver(() => {
    changed = true
  })
  observer.observe(element)

  try {
    while (
      generation === instanceGeneration &&
      element.isConnected &&
      performance.now() - startedAt < emergencyTimeoutMs
    ) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const rect = element.getBoundingClientRect()
      const stable =
        !changed &&
        Math.abs(rect.width - previousWidth) <= 1 &&
        Math.abs(rect.height - previousHeight) <= 1
      stableFrames = stable ? stableFrames + 1 : 0
      if (stableFrames >= stableFramesRequired) return
      changed = false
      previousWidth = rect.width
      previousHeight = rect.height
    }
  } finally {
    observer.disconnect()
  }
}
</script>

<template>
  <div ref="host" class="kpo-playground" :class="{ 'kpo-playground--ready': ready }">
    <div v-if="!ready" class="kpo-playground__skeleton" aria-live="polite">
      Загрузка Kotlin Playground…
    </div>
  </div>
</template>
