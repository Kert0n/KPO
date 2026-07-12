<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import KotlinPlayground from './KotlinPlayground.vue'
import { useCodeLanguage } from '../composables/useCodeLanguage'
import { usePlaygroundMode } from '../composables/usePlaygroundMode'
import {
  canUsePlayground,
  isSupportedCodeLanguage,
  parseCsv,
  resolveDisplayLanguage
} from '../lib/codeBlockModel'
import { preserveViewportAnchor } from '../lib/viewportAnchor'
import { waitForPlaygroundInitializations } from '../lib/playgroundLifecycle'

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
const playgroundElement = useTemplateRef<{
  whenSettled: () => Promise<'ready' | 'failed' | 'disposed'>
}>('playground')
const mounted = ref(false)
const authorDefaultReleased = ref(false)
const localUnsupportedLanguage = ref<string | null>(null)
const playgroundFailed = ref(false)
const playgroundEverShown = ref(false)
const kotlinCode = ref('')
const anchorPending = ref(false)

const langList = computed(() => parseCsv(props.langs))
const labelList = computed(() => parseCsv(props.labels))
const hasKotlin = computed(() => langList.value.includes('kotlin'))

/**
 * Показанный язык считается одной pure-моделью:
 * untouched author default > global language > initial.
 * После первого клика конкретный блок присоединяется к глобальному
 * выбору, чтобы последующие клики в других блоках переключали и его.
 */
const displayLang = computed(() => {
  return resolveDisplayLanguage({
    languages: langList.value,
    initialLanguage: props.initialLang,
    authorDefaultLanguage: props.authorDefaultLang,
    globalLanguage: mounted.value ? activeLanguage.value : null,
    authorDefaultProtected: Boolean(props.authorDefaultLang) && !authorDefaultReleased.value,
    localUnsupportedLanguage: localUnsupportedLanguage.value
  })
})

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

watch([displayLang, mounted], syncActiveBlock)

watch(
  playgroundActive,
  (active) => {
    if (active) playgroundEverShown.value = true
  },
  { immediate: true }
)

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

async function selectLanguage(lang: string, initiatingKeyEvent?: KeyboardEvent): Promise<void> {
  await runAnchored(
    () => {
      authorDefaultReleased.value = true

      if (isSupportedCodeLanguage(lang)) {
        localUnsupportedLanguage.value = null
        setActiveLanguage(lang)
        return
      }

      localUnsupportedLanguage.value = lang
    },
    2,
    initiatingKeyEvent
  )
}

async function togglePlayground(): Promise<void> {
  await runAnchored(() => {
    setPlaygroundMode(!playgroundMode.value)
  }, 3)
}

async function runAnchored(
  mutate: () => void,
  frames = 2,
  initiatingKeyEvent?: KeyboardEvent
): Promise<void> {
  anchorPending.value = true
  await nextTick()
  try {
    await preserveViewportAnchor(rootElement.value, mutate, {
      frames,
      settle: waitForActivePlayground,
      initiatingKeyEvent
    })
  } finally {
    anchorPending.value = false
  }
}

async function waitForActivePlayground(): Promise<void> {
  await nextTick()
  await waitForPlaygroundInitializations()
  if (!playgroundActive.value) return
  await playgroundElement.value?.whenSettled()
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
  void selectLanguage(langs[(next + langs.length) % langs.length], event)
}
</script>

<template>
  <section
    ref="root"
    class="kpo-switcher"
    :data-kpo-ask-block-id="askBlockId || undefined"
    :data-kpo-anchor-pending="anchorPending || undefined"
  >
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
      ref="playground"
      v-show="playgroundActive"
      :code="kotlinCode"
      :ask-block-id="askBlockId"
      @failed="playgroundFailed = true"
    />
  </section>
</template>
