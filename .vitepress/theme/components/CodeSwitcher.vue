<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import KotlinPlayground from './KotlinPlayground.vue'
import { useCodeLanguage } from '../composables/useCodeLanguage'
import { usePlaygroundMode } from '../composables/usePlaygroundMode'
import { useActiveCodeLanguage } from '../composables/code/useActiveCodeLanguage'
import { useCodeTabs } from '../composables/code/useCodeTabs'
import { useShikiBlocks } from '../composables/code/useShikiBlocks'
import { canUsePlayground, parseCsv } from '../lib/codeBlockModel'
import { preserveViewportAnchor } from '../lib/viewportAnchor'

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

const props = withDefaults(
  defineProps<{
    title?: string
    langs: string
    labels?: string
    initialLang?: string
    authorDefaultLang?: string
    allowPlayground?: boolean
    playgroundCode?: string
    askBlockId?: string
  }>(),
  {
    title: '',
    labels: '',
    initialLang: '',
    authorDefaultLang: '',
    allowPlayground: false,
    playgroundCode: '',
    askBlockId: ''
  }
)

const { activeLanguage, setActiveLanguage } = useCodeLanguage()
const { playgroundMode, setPlaygroundMode } = usePlaygroundMode()

const rootElement = useTemplateRef('root')
const blocksElement = useTemplateRef('blocks')
const playgroundFailed = ref(false)
const playgroundEverShown = ref(false)
const kotlinCode = ref('')

const langList = computed(() => parseCsv(props.langs))
const labelList = computed(() => parseCsv(props.labels))
const hasKotlin = computed(() => langList.value.includes('kotlin'))

/**
 * Показанный язык считается одной pure-моделью:
 * untouched author default > global language > initial.
 * После первого клика конкретный блок присоединяется к глобальному
 * выбору, чтобы последующие клики в других блоках переключали и его.
 */
const {
  hydrated: mounted,
  displayLanguage: displayLang,
  selectLanguage
} = useActiveCodeLanguage({
  root: rootElement,
  languages: langList,
  initialLanguage: () => props.initialLang,
  authorDefaultLanguage: () => props.authorDefaultLang,
  globalLanguage: activeLanguage,
  setGlobalLanguage: setActiveLanguage
})
const { extractKotlinCode } = useShikiBlocks(blocksElement, displayLang)
const { onTabsKeydown } = useCodeTabs(langList, displayLang, selectLanguage)

/** Playground возможен: блок им размечен, показан Kotlin, загрузка не падала */
const playgroundUsable = computed(() => {
  return (
    mounted.value &&
    canUsePlayground({
      allowPlayground: props.allowPlayground,
      displayLanguage: displayLang.value,
      playgroundFailed: playgroundFailed.value,
      hasKotlinCode: kotlinCode.value !== ''
    })
  )
})

/** Playground показан: возможен + включён читателем + есть исходник */
const playgroundActive = computed(() => {
  return mounted.value && playgroundUsable.value && playgroundMode.value && kotlinCode.value !== ''
})

const playgroundTitle = computed(() => {
  if (displayLang.value !== 'kotlin') return 'Playground доступен для Kotlin'
  if (playgroundFailed.value) return 'Playground недоступен'
  return playgroundMode.value ? 'Выключить интерактивный режим' : 'Включить интерактивный режим'
})

onMounted(() => {
  if (props.allowPlayground && hasKotlin.value) {
    kotlinCode.value = decodePlaygroundCode() || extractKotlinCode()
  }
  mounted.value = true
})

watch(
  playgroundActive,
  (active) => {
    if (active) playgroundEverShown.value = true
  },
  { immediate: true }
)

function decodePlaygroundCode(): string {
  if (!props.playgroundCode) return ''

  try {
    return decodeURIComponent(props.playgroundCode).replace(/\n$/, '')
  } catch {
    return props.playgroundCode.replace(/\n$/, '')
  }
}

function tabLabel(index: number): string {
  return labelList.value[index] ?? langList.value[index]
}

async function togglePlayground(): Promise<void> {
  await preserveViewportAnchor(
    rootElement.value,
    () => {
      setPlaygroundMode(!playgroundMode.value)
    },
    { frames: 3 }
  )
}
</script>

<template>
  <section ref="root" class="kpo-switcher" :data-kpo-ask-block-id="askBlockId || undefined">
    <header class="kpo-switcher__header">
      <span v-if="title" class="kpo-switcher__title">{{ title }}</span>

      <div class="kpo-switcher__controls">
        <button
          v-if="allowPlayground"
          type="button"
          class="kpo-switcher__playground-toggle"
          :disabled="!playgroundUsable"
          :aria-pressed="playgroundActive"
          :title="playgroundTitle"
          @click="togglePlayground"
        >
          <svg class="kpo-switcher__play-icon" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 1.5 L10 6 L2.5 10.5 Z" />
          </svg>
          Playground
        </button>

        <div class="kpo-switcher__tabs" role="tablist" aria-label="Язык примера" @keydown="onTabsKeydown">
          <button
            v-for="(lang, index) in langList"
            :key="lang"
            type="button"
            role="tab"
            class="kpo-switcher__tab"
            :class="{ 'kpo-switcher__tab--active': lang === displayLang }"
            :aria-selected="lang === displayLang"
            :tabindex="lang === displayLang ? 0 : -1"
            @click="void selectLanguage(lang)"
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
      :ask-block-id="askBlockId"
      @failed="playgroundFailed = true"
    />
  </section>
</template>
