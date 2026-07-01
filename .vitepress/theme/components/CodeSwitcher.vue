<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import KotlinPlayground from './KotlinPlayground.vue'
import { usePlayground } from '../composables/usePlayground'
import { useCodeLanguage, type CodeLanguage } from '../composables/useCodeLanguage'

type Language = CodeLanguage

type CodeBlock = {
  lang: Language
  label: string
  code: string
  highlightedHtml: string
}

const props = withDefaults(defineProps<{
  title?: string
  defaultLang?: Language
  playgroundLang?: 'kotlin' | ''
  blocks?: CodeBlock[]
  blocksJson?: string
}>(), {
  title: '',
  defaultLang: 'kotlin',
  playgroundLang: '',
  blocks: () => [],
  blocksJson: ''
})

const parsedBlocks = computed<CodeBlock[]>(() => {
  if (props.blocks.length > 0) return props.blocks
  if (!props.blocksJson) return []

  try {
    return JSON.parse(decodeURIComponent(props.blocksJson)) as CodeBlock[]
  } catch {
    return []
  }
})

const languages = computed<Language[]>(() => parsedBlocks.value.map((block) => block.lang))
const hasMountedPlayground = ref(false)
const playgroundFailed = ref(false)
const { playgroundEnabled } = usePlayground()
const {
  resolveLanguage,
  setActiveLanguage,
  registerPlayableKotlinSwitcher,
  unregisterPlayableKotlinSwitcher
} = useCodeLanguage()

const resolvedActiveLanguage = computed<Language>(() => {
  return resolveLanguage(props.defaultLang, languages.value)
})
const activeIndex = computed(() => Math.max(0, languages.value.indexOf(resolvedActiveLanguage.value)))
const activeBlock = computed(() => {
  return parsedBlocks.value.find((block) => block.lang === resolvedActiveLanguage.value) ?? parsedBlocks.value[0]
})

const isPlayableKotlin = computed(() => {
  return activeBlock.value?.lang === 'kotlin'
    && props.playgroundLang === 'kotlin'
    && playgroundEnabled.value
    && !playgroundFailed.value
})

watch(isPlayableKotlin, (enabled) => {
  if (enabled) hasMountedPlayground.value = true
}, { immediate: true })

onMounted(() => {
  if (props.playgroundLang === 'kotlin') {
    registerPlayableKotlinSwitcher()
  }
})

onUnmounted(() => {
  if (props.playgroundLang === 'kotlin') {
    unregisterPlayableKotlinSwitcher()
  }
})

function setLanguage(language: Language): void {
  setActiveLanguage(language)
}

function move(delta: number): void {
  if (languages.value.length === 0) return
  const nextIndex = (activeIndex.value + delta + languages.value.length) % languages.value.length
  setActiveLanguage(languages.value[nextIndex])
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    move(-1)
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    move(1)
  }

  if (event.key === 'Home') {
    event.preventDefault()
    if (languages.value[0]) setActiveLanguage(languages.value[0])
  }

  if (event.key === 'End') {
    event.preventDefault()
    const lastLanguage = languages.value[languages.value.length - 1]
    if (lastLanguage) setActiveLanguage(lastLanguage)
  }
}
</script>

<template>
  <section class="code-switcher">
    <header class="code-switcher__header">
      <span v-if="title" class="code-switcher__title">{{ title }}</span>
      <div
        class="code-switcher__tabs"
        role="tablist"
        aria-label="Язык примера"
        @keydown="onKeydown"
      >
        <span
          class="code-switcher__indicator"
          :style="{
            width: `${100 / Math.max(languages.length, 1)}%`,
            transform: `translateX(${activeIndex * 100}%)`
          }"
        />
        <button
          v-for="block in parsedBlocks"
          :key="block.lang"
          class="code-switcher__tab"
          :class="{ 'code-switcher__tab--active': block.lang === resolvedActiveLanguage }"
          type="button"
          role="tab"
          :aria-selected="block.lang === resolvedActiveLanguage"
          @click="setLanguage(block.lang)"
        >
          {{ block.label }}
        </button>
      </div>
    </header>

    <div v-if="activeBlock" class="code-switcher__body">
      <KotlinPlayground
        v-if="hasMountedPlayground && activeBlock.lang === 'kotlin' && playgroundLang === 'kotlin' && playgroundEnabled && !playgroundFailed"
        v-show="isPlayableKotlin"
        :code="activeBlock.code"
        @failed="playgroundFailed = true"
      />

      <div
        v-if="!isPlayableKotlin"
        class="code-switcher__static"
        v-html="activeBlock.highlightedHtml"
      />

      <p v-if="activeBlock.lang === 'kotlin' && playgroundFailed" class="code-switcher__fallback-note">
        Playground недоступен
      </p>
      <p v-else-if="activeBlock.lang === 'kotlin' && playgroundLang === 'kotlin' && !playgroundEnabled" class="code-switcher__fallback-note">
        Playground выключен
      </p>
    </div>
  </section>
</template>

<style scoped>
.code-switcher {
  margin: 1.5rem 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-code-bg);
}

.code-switcher__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--kpo-surface-soft);
}

.code-switcher__title {
  min-width: 0;
  color: var(--vp-c-text-1);
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
}

.code-switcher__tabs {
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(3.625rem, 1fr);
  min-width: min(17.875rem, 100%);
  padding: 0.1875rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--kpo-control-bg);
}

.code-switcher__indicator {
  position: absolute;
  top: 0.1875rem;
  bottom: 0.1875rem;
  left: 0.1875rem;
  width: 25%;
  border-radius: 5px;
  background: var(--kpo-control-active);
  box-shadow: 0 1px 4px rgb(0 0 0 / 12%);
  transition: transform 160ms ease;
}

.code-switcher__tab {
  position: relative;
  z-index: 1;
  min-height: 1.875rem;
  padding: 0 0.625rem;
  border: 0;
  border-radius: 5px;
  color: var(--vp-c-text-2);
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 650;
  line-height: 1;
  cursor: pointer;
}

.code-switcher__tab--active {
  color: var(--vp-c-text-1);
}

.code-switcher__tab:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.code-switcher__body {
  position: relative;
  max-width: 100%;
  overflow-x: auto;
  background: var(--vp-code-bg);
}

.code-switcher__static {
  min-width: 100%;
  background: var(--vp-code-bg);
}

.code-switcher__static :deep(pre) {
  width: max-content;
  min-width: 100%;
  margin: 0;
  padding: 1rem 0;
  border-radius: 0;
  background: var(--vp-code-bg);
  font-size: var(--kpo-code-font-size);
  line-height: var(--kpo-code-line-height);
}

.code-switcher__static :deep(code) {
  display: block;
  box-sizing: border-box;
  min-width: 100%;
  padding: 0 1.125rem 0 0;
  font-family: var(--vp-font-family-mono);
  font-size: var(--kpo-code-font-size);
  line-height: var(--kpo-code-line-height);
  counter-reset: kpo-code-line;
}

.code-switcher__static :deep(.line) {
  display: inline-block;
  min-height: var(--kpo-code-line-height);
  min-width: 100%;
}

.code-switcher__static :deep(.line::before) {
  counter-increment: kpo-code-line;
  content: counter(kpo-code-line);
  display: inline-block;
  width: 3.2em;
  padding-right: 1.1em;
  color: var(--vp-c-text-3);
  text-align: right;
  user-select: none;
}

.code-switcher__fallback-note {
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  background: var(--kpo-surface-soft);
  font-size: 0.75rem;
}

@media (max-width: 640px) {
  .code-switcher__header {
    align-items: stretch;
    flex-direction: column;
  }

  .code-switcher__tabs {
    min-width: 0;
    width: 100%;
  }
}
</style>
