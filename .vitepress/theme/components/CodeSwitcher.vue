<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import KotlinPlayground from './KotlinPlayground.vue'
import { useCodeLanguage } from '../composables/useCodeLanguage'
import { usePlaygroundMode } from '../composables/usePlaygroundMode'

/**
 * Переключатель языка для примера кода.
 *
 * Fence-блоки приходят в слот уже отрендеренными штатным пайплайном
 * VitePress (Shiki, номера строк, кнопка копирования), поэтому компонент
 * не трогает их содержимое — только переключает класс `active` на блоке
 * выбранного языка, как это делает встроенный ::: code-group.
 *
 * Гидрация: SSR-разметка показывает язык по умолчанию (класс `active`
 * ставит markdown-плагин), к глобально выбранному языку компонент
 * синхронизируется после монтирования (см. mounted).
 *
 * Геометрия шапки постоянна: кнопка Playground не исчезает при смене
 * языка или сбое инициализации, а лишь деактивируется.
 */

const props = withDefaults(defineProps<{
  title?: string
  langs: string
  labels?: string
  defaultLang?: string
  playground?: boolean
}>(), {
  title: '',
  labels: '',
  defaultLang: 'kotlin',
  playground: false
})

const { activeLanguage, setActiveLanguage } = useCodeLanguage()
const { playgroundMode, setPlaygroundMode } = usePlaygroundMode()

const blocksElement = useTemplateRef('blocks')
const mounted = ref(false)
const playgroundFailed = ref(false)
const playgroundEverShown = ref(false)
const kotlinCode = ref('')

const langList = computed(() => props.langs.split(',').filter(Boolean))
const labelList = computed(() => props.labels.split(',').filter(Boolean))

/** Показанный язык: глобальный выбор, при его отсутствии в блоке — default */
const displayLang = computed(() => {
  if (!mounted.value) return props.defaultLang
  return langList.value.includes(activeLanguage.value) ? activeLanguage.value : props.defaultLang
})

const playgroundUsable = computed(() => {
  return displayLang.value === 'kotlin' && !playgroundFailed.value
})

const playgroundActive = computed(() => {
  return mounted.value && playgroundUsable.value && playgroundMode.value && kotlinCode.value !== ''
})

const playgroundTitle = computed(() => {
  if (displayLang.value !== 'kotlin') return 'Playground доступен для Kotlin'
  if (playgroundFailed.value) return 'Playground недоступен'
  return playgroundMode.value ? 'Выключить интерактивный режим' : 'Включить интерактивный режим'
})

onMounted(() => {
  kotlinCode.value = extractKotlinCode()
  mounted.value = true
})

watch([displayLang, mounted], syncActiveBlock)

watch(playgroundActive, (active) => {
  if (active) playgroundEverShown.value = true
}, { immediate: true })

/** Переключает класс active на fence-блоке выбранного языка */
function syncActiveBlock(): void {
  const blocks = blocksElement.value?.querySelectorAll(':scope > [class*="language-"]') ?? []
  for (const block of blocks) {
    block.classList.toggle('active', blockLanguage(block) === displayLang.value)
  }
}

function blockLanguage(block: Element): string {
  for (const name of block.classList) {
    if (name.startsWith('language-')) return name.slice('language-'.length)
  }
  return ''
}

/** Исходник для playground: textContent Shiki-разметки — это ровно код */
function extractKotlinCode(): string {
  const code = blocksElement.value?.querySelector(':scope > .language-kotlin pre code')
  return code?.textContent?.replace(/\n$/, '') ?? ''
}

function tabLabel(index: number): string {
  return labelList.value[index] ?? langList.value[index]
}

function onTabsKeydown(event: KeyboardEvent): void {
  const langs = langList.value
  const current = Math.max(0, langs.indexOf(displayLang.value))
  const moves: Record<string, number> = {
    ArrowLeft: current - 1,
    ArrowRight: current + 1,
    Home: 0,
    End: langs.length - 1
  }

  const next = moves[event.key]
  if (next === undefined) return

  event.preventDefault()
  setActiveLanguage(langs[(next + langs.length) % langs.length])
}
</script>

<template>
  <section class="kpo-switcher">
    <header class="kpo-switcher__header">
      <span v-if="title" class="kpo-switcher__title">{{ title }}</span>

      <div class="kpo-switcher__controls">
        <button
          v-if="playground"
          type="button"
          class="kpo-switcher__playground-toggle"
          :disabled="!playgroundUsable"
          :aria-pressed="playgroundActive"
          :title="playgroundTitle"
          @click="setPlaygroundMode(!playgroundMode)"
        >
          <svg class="kpo-switcher__play-icon" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 1.5 L10 6 L2.5 10.5 Z" />
          </svg>
          Playground
        </button>

        <div
          class="kpo-switcher__tabs"
          role="tablist"
          aria-label="Язык примера"
          @keydown="onTabsKeydown"
        >
          <button
            v-for="(lang, index) in langList"
            :key="lang"
            type="button"
            role="tab"
            class="kpo-switcher__tab"
            :class="{ 'kpo-switcher__tab--active': lang === displayLang }"
            :aria-selected="lang === displayLang"
            :tabindex="lang === displayLang ? 0 : -1"
            @click="setActiveLanguage(lang)"
          >
            {{ tabLabel(index) }}
          </button>
        </div>
      </div>
    </header>

    <div ref="blocks" v-show="!playgroundActive" class="kpo-switcher__blocks">
      <slot />
    </div>

    <KotlinPlayground
      v-if="playgroundEverShown"
      v-show="playgroundActive"
      :code="kotlinCode"
      @failed="playgroundFailed = true"
    />
  </section>
</template>
