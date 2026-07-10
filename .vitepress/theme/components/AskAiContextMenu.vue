<script setup lang="ts">
import { useData, useRoute } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAskAiProvider } from '../composables/useAskAiProvider'
import { ASK_AI_PROVIDERS, type AskAiBlock, type AskAiPageContext } from '../../shared/core/askAiModel'
import { readPlaygroundCode } from '../lib/playgroundRegistry'
import { useAskAiActionPreparation } from '../composables/ask-ai/useAskAiActionPreparation'
import { useAskAiContextLoader } from '../composables/ask-ai/useAskAiContextLoader'
import { useClipboardFallback } from '../composables/ask-ai/useClipboardFallback'
import { useFloatingMenuPosition } from '../composables/ask-ai/useFloatingMenuPosition'
import { useTextSelection, type SelectionSnapshot } from '../composables/ask-ai/useTextSelection'

const route = useRoute()
const { page, site } = useData()
const { askAiProvider } = useAskAiProvider()

const snapshot = ref<SelectionSnapshot | null>(null)
const toast = ref('')
let toastTimer: number | null = null

const { menu, showMenu, hideMenu, restoreFocus } = useFloatingMenuPosition()
const { manualPrompt, manualPanel, copyPrompt, closeManualPrompt, trapManualDialogFocus } =
  useClipboardFallback(restoreFocus)
const { loadPageContext, queuePrefetch, abort } = useAskAiContextLoader({
  routePath: () => route.path,
  base: () => site.value.base,
  enabled: () => page.value.frontmatter.kpoAskAi !== false && page.value.frontmatter.askAi !== false
})
const { preparedAction, preparing, prepare, clear } = useAskAiActionPreparation({
  provider: askAiProvider,
  loadPageContext,
  fallbackContext,
  currentOverride: playgroundOverride
})

useTextSelection({
  onSelection(nextSnapshot, position, mode) {
    snapshot.value = nextSnapshot
    void prepare(nextSnapshot)
    showMenu(position.x, position.y, mode)
  }
})

const menuLabel = computed(() => {
  return (
    ASK_AI_PROVIDERS.find((provider) => provider.id === askAiProvider.value)?.menuLabel ?? 'Ask AI about this'
  )
})

const askAiButtonLabel = computed(() => {
  if (preparing.value) return menu.mode === 'mobile' ? 'Preparing...' : 'Preparing prompt...'
  return menu.mode === 'mobile' ? 'Ask AI' : menuLabel.value
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  clearToast()
})

watch(
  () => route.path,
  () => {
    abort()
    hideMenu()
    clear()
    queuePrefetch()
  }
)

watch(askAiProvider, () => {
  if (!menu.visible || !snapshot.value) return
  void prepare(snapshot.value)
})

function onKeydown(event: KeyboardEvent): void {
  if (manualPrompt.value && event.key === 'Tab') {
    trapManualDialogFocus(event)
    return
  }

  if (event.key === 'Escape') {
    hideMenu()
    closeManualPrompt()
  }
}

async function askAi(): Promise<void> {
  const prepared = preparedAction.value
  hideMenu()
  if (!prepared) return

  const { action, contextUnavailable } = prepared
  let openedWindow: Window | null = null
  try {
    let copied = false
    let copyPromise: Promise<boolean> | null = null
    if (action.copyPrompt) {
      copyPromise = copyPrompt(action.prompt)
    }

    if (action.openUrl) {
      openedWindow = openBlankWindow()
    }

    if (copyPromise) {
      copied = await copyPromise
    }

    if (action.openUrl) {
      navigateOpenedWindow(openedWindow, action.openUrl)
    } else {
      closeOpenedWindow(openedWindow)
    }

    showToast(actionToast(action.toastKind, copied, contextUnavailable))
  } catch (error) {
    closeOpenedWindow(openedWindow)
    showToast('Ask AI unavailable')
    console.warn('[ask-ai] не удалось выполнить Ask AI:', error)
  }
}

function actionToast(
  toastKind: 'copied' | 'copied-and-opened' | 'manual-copy' | 'unavailable',
  copied: boolean,
  contextUnavailable: boolean
): string {
  if (toastKind === 'unavailable') return 'Ask AI unavailable'
  if (toastKind === 'manual-copy') return 'Copy prompt manually'
  if (toastKind === 'copied' && !copied) return 'Copy prompt manually'
  if (toastKind === 'copied-and-opened' && !copied) return 'Copy prompt manually'

  const suffix = contextUnavailable ? ' without page context' : ''
  if (toastKind === 'copied') return `Prompt copied${suffix}`

  if (askAiProvider.value === 'claude') return `Prompt copied, opened Claude${suffix}`
  if (askAiProvider.value === 'deepseek') return `Prompt copied, opened DeepSeek${suffix}`
  return `Prompt copied, opened ChatGPT${suffix}`
}

function playgroundOverride(
  blockId: string
): { kind: 'playground'; language: 'kotlin'; markdown: string } | undefined {
  if (!blockId) return undefined
  const code = readPlaygroundCode(blockId)
  if (!code) return undefined
  return {
    kind: 'playground',
    language: 'kotlin',
    markdown: `\`\`\`kotlin\n${code.replace(/\n?$/, '\n')}\`\`\``
  }
}

function fallbackContext(selectedText: string): AskAiPageContext {
  const block: AskAiBlock = {
    id: 'fallback-selection',
    kind: 'paragraph',
    markdown: selectedText,
    plainText: selectedText,
    lineStart: 0,
    lineEnd: 0
  }

  return {
    courseTitle: site.value.title,
    courseDescription: site.value.description,
    pageTitle: page.value.title,
    pageDescription: page.value.description,
    sourcePath: page.value.relativePath,
    blocks: [block]
  }
}

function openBlankWindow(): Window | null {
  const opened = window.open('', '_blank')
  if (opened) opened.opener = null
  return opened
}

function navigateOpenedWindow(openedWindow: Window | null, url: string): void {
  if (openedWindow) {
    openedWindow.location.href = url
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function closeOpenedWindow(openedWindow: Window | null): void {
  try {
    openedWindow?.close()
  } catch {
    // Ignore browsers that disallow closing the pre-opened tab.
  }
}

function showToast(message: string): void {
  clearToast()
  toast.value = message
  toastTimer = window.setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 2200)
}

function clearToast(): void {
  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = null
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="menu.visible"
      class="kpo-ai-menu"
      :class="{ 'kpo-ai-menu--mobile': menu.mode === 'mobile' }"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      role="menu"
    >
      <button
        type="button"
        class="kpo-ai-menu__item"
        role="menuitem"
        :disabled="preparing || !preparedAction"
        @click="askAi"
      >
        {{ askAiButtonLabel }}
      </button>
    </div>

    <div v-if="toast" class="kpo-ai-toast" aria-live="polite">
      {{ toast }}
    </div>

    <div
      v-if="manualPrompt"
      class="kpo-ai-manual"
      role="dialog"
      aria-modal="true"
      aria-label="Copy AI prompt"
    >
      <div ref="manualPanel" class="kpo-ai-manual__panel">
        <p class="kpo-ai-manual__title">Copy AI prompt</p>
        <textarea :value="manualPrompt" aria-label="AI prompt" readonly />
        <button type="button" @click="closeManualPrompt">Close</button>
      </div>
    </div>
  </Teleport>
</template>
