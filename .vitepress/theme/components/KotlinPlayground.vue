<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  code: string
}>()

const emit = defineEmits<{
  failed: []
}>()

const elementId = `kotlin-playground-${Math.random().toString(36).slice(2)}`
const initializing = ref(true)
const mountElement = ref<HTMLElement | null>(null)
let themeObserver: MutationObserver | undefined
let initialized = false

onMounted(async () => {
  try {
    observeTheme()
    await nextTick()
    renderCodeBlock()

    const initPlayground = await loadKotlinPlayground()
    await initializePlayground(initPlayground)
  } catch {
    emit('failed')
  } finally {
    initializing.value = false
  }
})

onBeforeUnmount(() => {
  themeObserver?.disconnect()
})

function renderCodeBlock(): void {
  const mount = mountElement.value
  if (!mount) return

  mount.innerHTML = ''

  const pre = document.createElement('pre')
  const code = document.createElement('code')

  pre.className = 'kotlin-playground__pre'
  code.id = elementId
  code.dataset.targetPlatform = 'java'
  code.dataset.outputHeight = '160'
  code.dataset.autocomplete = 'true'
  code.setAttribute('theme', getPlaygroundTheme())
  code.setAttribute('mode', 'kotlin')
  code.setAttribute('lines', 'true')
  code.textContent = props.code

  pre.appendChild(code)
  mount.appendChild(pre)
}

async function loadKotlinPlayground(): Promise<(selector: string) => void> {
  const cdnInitializer = await loadKotlinPlaygroundFromCdn().catch(() => undefined)
  if (typeof cdnInitializer === 'function') {
    return cdnInitializer
  }

  const playgroundModule = await import('kotlin-playground').catch(() => undefined)
  const moduleInitializer = playgroundModule
    ? (playgroundModule.default ?? playgroundModule)
    : undefined

  if (typeof moduleInitializer === 'function') {
    return moduleInitializer
  }

  throw new TypeError('Kotlin Playground initializer is unavailable.')
}

function loadKotlinPlaygroundFromCdn(): Promise<unknown> {
  const existing = window.KotlinPlayground
  if (typeof existing === 'function') {
    return Promise.resolve(existing)
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/kotlin-playground@1'
    script.async = true
    script.onload = () => resolve(window.KotlinPlayground)
    script.onerror = () => reject(new Error('Failed to load Kotlin Playground CDN script.'))
    document.head.appendChild(script)
  })
}

async function initializePlayground(initPlayground: (selector: string) => void): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (isInitialized()) {
      initialized = true
      return
    }

    initPlayground(`#${elementId}`)
    await delay(350)

    if (isInitialized()) {
      initialized = true
      return
    }
  }

  throw new Error('Kotlin Playground did not initialize the target code block.')
}

function isInitialized(): boolean {
  const mount = mountElement.value

  return Boolean(
    mount?.querySelector(`code#${elementId}[data-kotlin-playground-initialized="true"]`)
    || mount?.querySelector('.CodeMirror, .run-button, .executable-fragment')
  )
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function getPlaygroundTheme(): 'idea' | 'darcula' {
  return document.documentElement.classList.contains('dark') ? 'darcula' : 'idea'
}

function observeTheme(): void {
  themeObserver = new MutationObserver(async () => {
    if (!initialized) return

    try {
      initialized = false
      initializing.value = true
      renderCodeBlock()
      const initPlayground = await loadKotlinPlayground()
      await initializePlayground(initPlayground)
    } catch {
      emit('failed')
    } finally {
      initializing.value = false
    }
  })

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
}
</script>

<template>
  <div class="kotlin-playground">
    <div v-if="initializing" class="kotlin-playground__status">Загрузка Playground...</div>
    <div ref="mountElement" class="kotlin-playground__mount" />
  </div>
</template>

<style scoped>
.kotlin-playground {
  position: relative;
  max-width: 100%;
  overflow-x: auto;
  background: var(--vp-code-bg);
}

.kotlin-playground__status {
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  background: var(--kpo-surface-soft);
  font-size: 12px;
}

.kotlin-playground :deep(.kotlin-playground__pre) {
  margin: 0;
  border-radius: 0;
  max-width: 100%;
  overflow-x: auto;
}

.kotlin-playground :deep(.kotlin-playground__pre code) {
  display: block;
  min-width: 100%;
  width: max-content;
}

.kotlin-playground :deep(.executable-fragment-wrapper),
.kotlin-playground :deep(.executable-fragment),
.kotlin-playground :deep(.code-area) {
  border-color: var(--vp-c-divider) !important;
  background: var(--vp-code-bg) !important;
}

.kotlin-playground :deep(.CodeMirror) {
  max-width: 100%;
  min-height: 320px;
  color: var(--vp-c-text-1);
  background: var(--vp-code-bg) !important;
  font-family: var(--vp-font-family-mono) !important;
  font-size: var(--kpo-code-font-size) !important;
  line-height: var(--kpo-code-line-height) !important;
}

.kotlin-playground :deep(.CodeMirror pre),
.kotlin-playground :deep(.CodeMirror-code),
.kotlin-playground :deep(.CodeMirror-line),
.kotlin-playground :deep(.CodeMirror-line span) {
  font-family: var(--vp-font-family-mono) !important;
  font-size: var(--kpo-code-font-size) !important;
  line-height: var(--kpo-code-line-height) !important;
}

.kotlin-playground :deep(.CodeMirror-gutters) {
  border-right: 1px solid var(--vp-c-divider) !important;
  background: var(--vp-code-bg) !important;
}

.kotlin-playground :deep(.CodeMirror-linenumber) {
  color: var(--vp-c-text-3) !important;
  font-size: 12px !important;
  padding: 0 10px 0 6px !important;
}

.kotlin-playground :deep(.CodeMirror-lines) {
  padding: 16px 0 !important;
}

.kotlin-playground :deep(.CodeMirror pre.CodeMirror-line),
.kotlin-playground :deep(.CodeMirror pre.CodeMirror-line-like) {
  padding: 0 18px 0 12px !important;
}

.kotlin-playground :deep(.CodeMirror-scroll) {
  overflow: auto !important;
}

.kotlin-playground :deep(.cm-keyword),
.kotlin-playground :deep(.cm-atom) {
  color: var(--kpo-code-keyword) !important;
}

.kotlin-playground :deep(.cm-string),
.kotlin-playground :deep(.cm-string-2) {
  color: var(--kpo-code-string) !important;
}

.kotlin-playground :deep(.cm-number) {
  color: var(--kpo-code-number) !important;
}

.kotlin-playground :deep(.cm-comment) {
  color: var(--kpo-code-comment) !important;
}

.kotlin-playground :deep(.cm-def),
.kotlin-playground :deep(.cm-variable-2),
.kotlin-playground :deep(.cm-property) {
  color: var(--kpo-code-function) !important;
}

.kotlin-playground :deep(.cm-operator) {
  color: var(--kpo-code-operator) !important;
}

.kotlin-playground :deep(.run-button),
.kotlin-playground :deep(.theme-button),
.kotlin-playground :deep(.compiler-info),
.kotlin-playground :deep(.open-in-playground-link) {
  font-family: var(--vp-font-family-mono) !important;
  font-size: 12px !important;
}

.kotlin-playground :deep(.run-button) {
  border-color: var(--vp-c-brand-1) !important;
  color: var(--vp-c-brand-1) !important;
  background: color-mix(in srgb, var(--vp-c-brand-1) 10%, transparent) !important;
}

.kotlin-playground :deep(.output-wrapper),
.kotlin-playground :deep(.output) {
  border-color: var(--vp-c-divider) !important;
  color: var(--vp-c-text-1) !important;
  background: var(--kpo-surface-soft) !important;
  font-family: var(--vp-font-family-mono) !important;
  font-size: var(--kpo-code-font-size) !important;
  line-height: var(--kpo-code-line-height) !important;
}

.kotlin-playground :deep(textarea) {
  max-width: 100%;
}
</style>
