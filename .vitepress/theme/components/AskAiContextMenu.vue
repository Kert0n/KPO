<script setup lang="ts">
import { useData, useRoute, withBase } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAskAiActionPreparation } from '../composables/useAskAiActionPreparation'
import { useAskAiContextLoader } from '../composables/useAskAiContextLoader'
import { useAskAiProvider } from '../composables/useAskAiProvider'
import { useClipboardFallback } from '../composables/useClipboardFallback'
import { useFloatingMenuPosition } from '../composables/useFloatingMenuPosition'
import { useTextSelection, type SelectionSnapshot } from '../composables/useTextSelection'
import { ASK_AI_PROVIDERS, type AskAiBlock, type AskAiPageContext } from '../lib/askAiModel'

const route = useRoute()
const { page, site } = useData()
const { askAiProvider } = useAskAiProvider()
const { menu, showMenu, hideMenu } = useFloatingMenuPosition()
const { createSelectionSnapshot, selectedRangeRect } = useTextSelection()
const contextLoader = useAskAiContextLoader({
  routePath: () => route.path,
  base: () => site.value.base,
  withBase
})
const clipboardFallback = useClipboardFallback()
const { manualPrompt, copyPrompt, closeManualPrompt, handleDialogKeydown } = clipboardFallback
const actionPreparation = useAskAiActionPreparation({
  provider: askAiProvider,
  loadPageContext: contextLoader.loadPageContext,
  fallbackContext
})
const { preparedAction, preparing } = actionPreparation

const snapshot = ref<SelectionSnapshot | null>(null)
const toast = ref('')
let toastTimer: number | null = null
let mobileSelectionTimer: number | null = null

const menuLabel = computed(() => {
  return (
    ASK_AI_PROVIDERS.find((provider) => provider.id === askAiProvider.value)?.menuLabel ??
    'Ask AI about this'
  )
})

const askAiButtonLabel = computed(() => {
  if (preparing.value) return menu.mode === 'mobile' ? 'Preparing...' : 'Preparing prompt...'
  return menu.mode === 'mobile' ? 'Ask AI' : menuLabel.value
})

onMounted(() => {
  document.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('pointerup', onPointerUp)
  window.addEventListener('scroll', hideMenu, true)
  window.addEventListener('resize', hideMenu)
  contextLoader.queuePrefetch()
})

onBeforeUnmount(() => {
  document.removeEventListener('contextmenu', onContextMenu)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('scroll', hideMenu, true)
  window.removeEventListener('resize', hideMenu)
  clearToast()
  clearMobileSelectionTimer()
  actionPreparation.clear()
  contextLoader.dispose()
  clipboardFallback.dispose()
})

watch(
  () => route.path,
  () => {
    hideMenu()
    snapshot.value = null
    clearMobileSelectionTimer()
    clipboardFallback.dispose()
    actionPreparation.clear()
    contextLoader.invalidateRoute()
    contextLoader.queuePrefetch()
  }
)

watch(askAiProvider, () => {
  if (!menu.visible || !snapshot.value) return
  void actionPreparation.prepare(snapshot.value)
})

function onContextMenu(event: MouseEvent): void {
  if (event.shiftKey) return
  const nextSnapshot = createSelectionSnapshot(event.target)
  if (!nextSnapshot) return

  event.preventDefault()
  snapshot.value = nextSnapshot
  menu.mode = 'desktop'
  void actionPreparation.prepare(nextSnapshot)
  showMenu(event.clientX, event.clientY)
}

function onSelectionChange(): void {
  clearMobileSelectionTimer()
  if (!isMobileLike()) return

  mobileSelectionTimer = window.setTimeout(() => {
    const nextSnapshot = createSelectionSnapshot(document.activeElement)
    if (!nextSnapshot) return
    const rect = selectedRangeRect()
    if (!rect) return

    snapshot.value = nextSnapshot
    menu.mode = 'mobile'
    void actionPreparation.prepare(nextSnapshot)
    showMenu(rect.left + rect.width / 2, rect.top - 12)
  }, 220)
}

function onPointerUp(): void {
  if (isMobileLike()) onSelectionChange()
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Element && target.closest('.kpo-ai-menu, .kpo-ai-manual')) return
  hideMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (handleDialogKeydown(event)) return
  if (event.key === 'Escape') hideMenu()
}

async function askAi(): Promise<void> {
  const prepared = preparedAction.value
  hideMenu()
  if (!prepared) return
  clipboardFallback.setRestoreFocusTarget(
    [...document.querySelectorAll<HTMLElement>('.KpoAskAiProvider > button')].find(
      (button) => button.offsetParent !== null
    ) ?? null
  )

  const { action, contextUnavailable } = prepared
  let openedWindow: Window | null = null
  try {
    let copied = false
    let copyPromise: Promise<boolean> | null = null
    if (action.copyPrompt) copyPromise = copyPrompt(action.prompt)
    if (action.openUrl) openedWindow = openBlankWindow()
    if (copyPromise) copied = await copyPromise

    if (action.openUrl) navigateOpenedWindow(openedWindow, action.openUrl)
    else closeOpenedWindow(openedWindow)

    showToast(actionToast(action.toastKind, copied, contextUnavailable))
  } catch (error) {
    closeOpenedWindow(openedWindow)
    showToast('Ask AI unavailable')
    console.warn('[ask-ai] не удалось выполнить Ask AI:', error)
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

function actionToast(
  toastKind: 'copied' | 'copied-and-opened' | 'manual-copy' | 'unavailable',
  copied: boolean,
  contextUnavailable: boolean
): string {
  if (toastKind === 'unavailable') return 'Ask AI unavailable'
  if (toastKind === 'manual-copy') return 'Copy prompt manually'
  if ((toastKind === 'copied' || toastKind === 'copied-and-opened') && !copied) {
    return 'Copy prompt manually'
  }

  const suffix = contextUnavailable ? ' without page context' : ''
  if (toastKind === 'copied') return `Prompt copied${suffix}`
  if (askAiProvider.value === 'claude') return `Prompt copied, opened Claude${suffix}`
  if (askAiProvider.value === 'deepseek') return `Prompt copied, opened DeepSeek${suffix}`
  return `Prompt copied, opened ChatGPT${suffix}`
}

function isMobileLike(): boolean {
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

function openBlankWindow(): Window | null {
  const opened = window.open('', '_blank')
  if (opened) opened.opener = null
  return opened
}

function navigateOpenedWindow(openedWindow: Window | null, url: string): void {
  if (openedWindow) openedWindow.location.href = url
  else window.open(url, '_blank', 'noopener,noreferrer')
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

function clearMobileSelectionTimer(): void {
  if (mobileSelectionTimer !== null) window.clearTimeout(mobileSelectionTimer)
  mobileSelectionTimer = null
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
      <div class="kpo-ai-manual__panel">
        <p class="kpo-ai-manual__title">Copy AI prompt</p>
        <textarea :value="manualPrompt" readonly />
        <button type="button" @click="closeManualPrompt">Close</button>
      </div>
    </div>
  </Teleport>
</template>
