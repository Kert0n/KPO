<script setup lang="ts">
import { computed, onMounted, ref, useId, useTemplateRef, watch } from 'vue'
import KotlinPlayground from './KotlinPlayground.vue'
import { useActiveCodeLanguage } from '../composables/useActiveCodeLanguage'
import { useCodeLanguage } from '../composables/useCodeLanguage'
import { useCodeTabs } from '../composables/useCodeTabs'
import { usePlaygroundMode } from '../composables/usePlaygroundMode'
import { usePlaygroundController } from '../composables/usePlaygroundController'
import { useShikiBlocks } from '../composables/useShikiBlocks'
import type { PlaygroundLifecycle } from '../lib/playgroundLifecycle'

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
 * Кнопка Playground относится только к активному Kotlin-варианту.
 * Изменение геометрии и асинхронная инициализация компенсируются
 * scoped viewport anchor, который ждёт именно этот Playground.
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
const playgroundElement = useTemplateRef<{ lifecycle: PlaygroundLifecycle }>('playground')
const accessibilityId = `kpo-code-${props.askBlockId || useId()}`
const mounted = ref(false)
const tabs = useCodeTabs({ langs: () => props.langs, labels: () => props.labels })
const { languages: langList } = tabs
const hasKotlin = computed(() => langList.value.includes('kotlin'))
const language = useActiveCodeLanguage({
  languages: langList,
  initialLanguage: () => props.initialLang,
  authorDefaultLanguage: () => props.authorDefaultLang,
  mounted,
  globalLanguage: activeLanguage,
  setGlobalLanguage: setActiveLanguage
})
const { displayLanguage: displayLang } = language
const shiki = useShikiBlocks({
  blocks: blocksElement,
  displayLanguage: displayLang,
  encodedPlaygroundCode: () => props.playgroundCode,
  tabId: (language) => tabId(language),
  panelId: (language) => codePanelId(language)
})
const { kotlinCode } = shiki
const playground = usePlaygroundController({
  root: rootElement,
  playground: playgroundElement,
  mounted,
  displayLanguage: displayLang,
  allowPlayground: () => props.allowPlayground,
  hasKotlin,
  kotlinCode,
  mode: playgroundMode,
  setMode: setPlaygroundMode
})
const {
  everShown: playgroundEverShown,
  usable: playgroundUsable,
  active: playgroundActive,
  title: playgroundTitle
} = playground

onMounted(() => {
  if (props.allowPlayground && hasKotlin.value) {
    shiki.initialize(true)
  }
  mounted.value = true
})

watch([displayLang, mounted], shiki.syncActiveBlock)

async function selectLanguage(lang: string, initiatingKeyEvent?: KeyboardEvent): Promise<void> {
  await playground.runAnchored(() => language.select(lang), initiatingKeyEvent)
}

function onTabsKeydown(event: KeyboardEvent): void {
  const next = tabs.languageForKey(displayLang.value, event.key)
  if (!next) return

  event.preventDefault()
  void selectLanguage(next, event)
}

function tabId(lang: string): string {
  return `${accessibilityId}-tab-${lang}`
}

function codePanelId(lang: string): string {
  return `${accessibilityId}-panel-${lang}`
}

function controlledPanelId(lang: string): string {
  return lang === 'kotlin' && playgroundActive.value
    ? `${accessibilityId}-playground-panel`
    : codePanelId(lang)
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
          @click="playground.toggle"
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
            :id="tabId(lang)"
            class="kpo-switcher__tab"
            :class="{ 'kpo-switcher__tab--active': lang === displayLang }"
            :aria-selected="lang === displayLang"
            :aria-controls="controlledPanelId(lang)"
            :tabindex="lang === displayLang ? 0 : -1"
            @click="void selectLanguage(lang)"
          >
            {{ tabs.labelAt(index) }}
          </button>
        </div>
      </div>
    </header>

    <div ref="blocks" v-show="!playgroundActive" class="kpo-switcher__blocks">
      <slot />
    </div>

    <KotlinPlayground
      v-if="playgroundEverShown"
      ref="playground"
      v-show="playgroundActive"
      :code="kotlinCode"
      :ask-block-id="askBlockId"
      :panel-id="`${accessibilityId}-playground-panel`"
      :labelledby="tabId('kotlin')"
      @failed="playground.markFailed"
    />
  </section>
</template>
