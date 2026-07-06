<script setup lang="ts">
import { useData, useRoute, withBase } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAskAiProvider } from '../composables/useAskAiProvider'
import {
  ASK_AI_PROVIDERS,
  askAiContextUrlForRoute,
  resolveAskAiProviderAction,
  routePathToAskAiContextKey,
  type AskAiBlock,
  type AskAiPageContext
} from '../lib/askAiModel'
import {
  readPlaygroundCode,
  readPlaygroundSelection
} from '../lib/playgroundRegistry'

type SelectionSnapshot = {
  selectedText: string
  blockIds: string[]
  playgroundBlockId: string
}

const route = useRoute()
const { page, site } = useData()
const { askAiProvider } = useAskAiProvider()

const menu = reactive({
  visible: false,
  x: 0,
  y: 0,
  mode: 'desktop' as 'desktop' | 'mobile'
})
const snapshot = ref<SelectionSnapshot | null>(null)
const toast = ref('')
const manualPrompt = ref('')
const contextCache = new Map<string, AskAiPageContext>()

let toastTimer: number | null = null
let mobileSelectionTimer: number | null = null

const menuLabel = computed(() => {
  return ASK_AI_PROVIDERS.find((provider) => provider.id === askAiProvider.value)?.menuLabel
    ?? 'Ask AI about this'
})

onMounted(() => {
  document.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('pointerup', onPointerUp)
  window.addEventListener('scroll', hideMenu, true)
  window.addEventListener('resize', hideMenu)
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
})

watch(() => route.path, () => {
  hideMenu()
})

function onContextMenu(event: MouseEvent): void {
  if (event.shiftKey) return

  const nextSnapshot = createSelectionSnapshot(event.target)
  if (!nextSnapshot) return

  event.preventDefault()
  snapshot.value = nextSnapshot
  menu.mode = 'desktop'
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
    showMenu(rect.left + rect.width / 2, rect.top - 12)
  }, 220)
}

function onPointerUp(): void {
  if (!isMobileLike()) return
  onSelectionChange()
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Element && target.closest('.kpo-ai-menu, .kpo-ai-manual')) return
  hideMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    hideMenu()
    manualPrompt.value = ''
  }
}

async function askAi(): Promise<void> {
  const currentSnapshot = snapshot.value
  hideMenu()
  if (!currentSnapshot || currentSnapshot.selectedText.trim() === '') return

  const openedWindow = askAiProvider.value === 'clipboard' ? null : openBlankWindow()

  try {
    let contextUnavailable = false
    const pageContext = await loadPageContext().catch(() => {
      contextUnavailable = true
      return fallbackContext(currentSnapshot.selectedText)
    })
    const action = resolveAskAiProviderAction(askAiProvider.value, {
      pageContext,
      selectedText: currentSnapshot.selectedText,
      blockIds: currentSnapshot.blockIds,
      currentOverride: playgroundOverride(currentSnapshot.playgroundBlockId)
    })

    let copied = false
    if (action.copyPrompt) {
      copied = await copyPrompt(action.prompt)
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
    console.warn('[ask-ai] не удалось подготовить prompt:', error)
  }
}

function actionToast(
  toastKind: 'opened' | 'copied' | 'copied-and-opened' | 'manual-copy' | 'unavailable',
  copied: boolean,
  contextUnavailable: boolean
): string {
  if (toastKind === 'unavailable') return 'Ask AI unavailable'
  if (toastKind === 'manual-copy') return 'Copy prompt manually'
  if (toastKind === 'copied' && !copied) return 'Copy prompt manually'
  if (toastKind === 'copied-and-opened' && !copied) return 'Copy prompt manually'

  const suffix = contextUnavailable ? ' without page context' : ''
  if (toastKind === 'opened') return `Opened ChatGPT${suffix}`
  if (toastKind === 'copied') return `Prompt copied${suffix}`

  if (askAiProvider.value === 'claude') return `Prompt copied, opened Claude${suffix}`
  if (askAiProvider.value === 'deepseek') return `Prompt copied, opened DeepSeek${suffix}`
  return `Prompt copied, opened ChatGPT${suffix}`
}

async function loadPageContext(): Promise<AskAiPageContext> {
  const key = routePathToAskAiContextKey(route.path, site.value.base)
  const cached = contextCache.get(key)
  if (cached) return cached

  const response = await fetch(askAiContextUrlForRoute(route.path, site.value.base, withBase))
  if (!response.ok) throw new Error(`Ask AI context HTTP ${response.status}`)

  const context = await response.json() as AskAiPageContext
  contextCache.set(key, context)
  return context
}

function createSelectionSnapshot(target: EventTarget | null): SelectionSnapshot | null {
  const targetElement = target instanceof Element ? target : null
  const playgroundBlockId = closestPlaygroundBlockId(targetElement)
  const playgroundSelection = playgroundBlockId ? readPlaygroundSelection(playgroundBlockId) : ''

  if (playgroundSelection) {
    return {
      selectedText: playgroundSelection,
      blockIds: [playgroundBlockId],
      playgroundBlockId
    }
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const selectedText = selection.toString().trim()
  if (selectedText === '') return null

  const content = document.querySelector('.vp-doc')
  if (!content || !selectionBelongsToContent(selection, content)) return null

  const blockIds = selectedBlockIds(selection, content)
  if (blockIds.length === 0) return null

  return {
    selectedText,
    blockIds,
    playgroundBlockId: playgroundBlockId || ''
  }
}

function selectedBlockIds(selection: Selection, content: Element): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const blocks = [...content.querySelectorAll<HTMLElement>('[data-kpo-ask-block-id]')]

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement
    const closest = ancestor?.closest<HTMLElement>('[data-kpo-ask-block-id]')
    if (closest?.dataset.kpoAskBlockId) addId(ids, seen, closest.dataset.kpoAskBlockId)

    for (const block of blocks) {
      if (!range.intersectsNode(block)) continue
      const id = block.dataset.kpoAskBlockId
      if (id) addId(ids, seen, id)
    }
  }

  return ids
}

function selectionBelongsToContent(selection: Selection, content: Element): boolean {
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer as Element
      : range.commonAncestorContainer.parentElement
    if (container && content.contains(container)) return true
  }
  return false
}

function selectedRangeRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const rect = selection.getRangeAt(0).getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return null
  return rect
}

function playgroundOverride(blockId: string): { kind: 'playground'; language: 'kotlin'; markdown: string } | undefined {
  if (!blockId) return undefined
  const code = readPlaygroundCode(blockId)
  if (!code) return undefined
  return {
    kind: 'playground',
    language: 'kotlin',
    markdown: `\`\`\`kotlin\n${code.replace(/\n?$/, '\n')}\`\`\``
  }
}

async function copyPrompt(prompt: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(prompt)
    return true
  } catch {
    if (copyWithTextarea(prompt)) return true
  }

  manualPrompt.value = prompt
  await nextTick()
  document.querySelector<HTMLTextAreaElement>('.kpo-ai-manual textarea')?.select()
  return false
}

function copyWithTextarea(prompt: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = prompt
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    textarea.remove()
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

function showMenu(x: number, y: number): void {
  const width = menu.mode === 'mobile' ? 112 : 220
  const height = 44
  menu.x = clamp(x, 8 + width / 2, window.innerWidth - 8 - width / 2)
  menu.y = clamp(y, 8, window.innerHeight - 8 - height)
  menu.visible = true
}

function hideMenu(): void {
  menu.visible = false
}

function isMobileLike(): boolean {
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

function closestPlaygroundBlockId(element: Element | null): string {
  const block = element?.closest<HTMLElement>('.kpo-switcher[data-kpo-ask-block-id]')
  if (!block?.querySelector('.kpo-playground')) return ''
  return block.dataset.kpoAskBlockId ?? ''
}

function addId(ids: string[], seen: Set<string>, id: string): void {
  if (seen.has(id)) return
  seen.add(id)
  ids.push(id)
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

function clearMobileSelectionTimer(): void {
  if (mobileSelectionTimer !== null) window.clearTimeout(mobileSelectionTimer)
  mobileSelectionTimer = null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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
      <button type="button" class="kpo-ai-menu__item" role="menuitem" @click="askAi">
        {{ menu.mode === 'mobile' ? 'Ask AI' : menuLabel }}
      </button>
    </div>

    <div v-if="toast" class="kpo-ai-toast" aria-live="polite">
      {{ toast }}
    </div>

    <div v-if="manualPrompt" class="kpo-ai-manual" role="dialog" aria-modal="true" aria-label="Copy AI prompt">
      <div class="kpo-ai-manual__panel">
        <p class="kpo-ai-manual__title">Copy AI prompt</p>
        <textarea :value="manualPrompt" readonly />
        <button type="button" @click="manualPrompt = ''">Close</button>
      </div>
    </div>
  </Teleport>
</template>
