<script setup lang="ts">
import { useData, useRoute, withBase } from 'vitepress'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useAskAiActionPreparation } from '../composables/useAskAiActionPreparation'
import { useAskAiContextLoader } from '../composables/useAskAiContextLoader'
import { useAskAiProvider } from '../composables/useAskAiProvider'
import { useClipboardFallback } from '../composables/useClipboardFallback'
import { useFloatingMenuPosition } from '../composables/useFloatingMenuPosition'
import { useSuggestEdit } from '../composables/useSuggestEdit'
import { useTextSelection, type SelectionSnapshot } from '../composables/useTextSelection'
import { ASK_AI_PROVIDERS, type AskAiBlock, type AskAiPageContext } from '../lib/askAiModel'
import { copyPromptToClipboard } from '../lib/clipboardPrompt'
import { githubEditUrl, githubIssueUrl, type SourceLines } from '../lib/suggestEditModel'
import { SITE } from '../../shared/site'

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
const { preparedAction, prepareError, preparing } = actionPreparation

const { editableSourcePath, tourRequest, dismissAnnouncement } = useSuggestEdit()
/** Ширина меню с подписью демонстрации; совпадает с .kpo-ai-menu--tour в CSS */
const TOUR_MENU_WIDTH = 300

const snapshot = ref<SelectionSnapshot | null>(null)
const toast = ref('')
const touring = ref(false)
const menuElement = useTemplateRef<HTMLElement>('menuElement')
let toastTimer: number | null = null
let mobileSelectionTimer: number | null = null
let tourTimer: number | null = null
let keyboardMenuInitiator: HTMLElement | null = null

const menuLabel = computed(() => {
  return (
    ASK_AI_PROVIDERS.find((provider) => provider.id === askAiProvider.value)?.menuLabel ??
    'Ask AI about this'
  )
})

const askAiButtonLabel = computed(() => {
  if (prepareError.value instanceof Error) return prepareError.value.message
  if (preparing.value) return menu.mode === 'mobile' ? 'Preparing...' : 'Preparing prompt...'
  return menu.mode === 'mobile' ? 'Ask AI' : menuLabel.value
})

onMounted(() => {
  document.addEventListener('contextmenu', onContextMenu)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('selectionchange', onSelectionChange)
  document.addEventListener('pointerup', onPointerUp)
  document.addEventListener('wheel', onScrollIntent, { passive: true })
  document.addEventListener('touchmove', onScrollIntent, { passive: true })
  window.addEventListener('resize', closeMenuWithoutRestore)
  void queueAvailablePageContext()
})

onBeforeUnmount(() => {
  document.removeEventListener('contextmenu', onContextMenu)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('selectionchange', onSelectionChange)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('wheel', onScrollIntent)
  document.removeEventListener('touchmove', onScrollIntent)
  window.removeEventListener('resize', closeMenuWithoutRestore)
  clearToast()
  clearMobileSelectionTimer()
  clearTourTimer()
  actionPreparation.clear()
  contextLoader.dispose()
  clipboardFallback.dispose()
})

watch(
  () => route.path,
  () => {
    closeMenuWithoutRestore()
    snapshot.value = null
    clearMobileSelectionTimer()
    clearTourTimer()
    clipboardFallback.dispose()
    actionPreparation.clear()
    contextLoader.invalidateRoute()
    void queueAvailablePageContext()
  }
)

watch(
  () => menu.visible,
  (visible) => {
    if (!visible) touring.value = false
  }
)

// Демонстрация жеста из анонса: выделяем начало абзаца и открываем меню
// так, как его открыл бы читатель.
watch(tourRequest, () => {
  clearTourTimer()
  const phrase = tourPhraseRange()
  // Без подходящего абзаца показывать нечего: анонс остаётся на месте.
  if (!phrase) return
  dismissAnnouncement()
  // Меню на мобильном встаёт над фразой, на десктопе — под ней: оставляем ему место.
  const anchor = isMobileLike() ? 0.6 : 0.3
  window.scrollTo({
    top: phrase.range.getBoundingClientRect().top + window.scrollY - window.innerHeight * anchor,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
  })
  tourTimer = window.setTimeout(() => {
    tourTimer = null
    if (!phrase.target.isConnected) return
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(phrase.range)
    const nextSnapshot = createSelectionSnapshot(phrase.target)
    const rect = selectedRangeRect()
    if (!nextSnapshot || !rect) return

    clearMobileSelectionTimer()
    snapshot.value = nextSnapshot
    touring.value = true
    menu.mode = isMobileLike() ? 'mobile' : 'desktop'
    void actionPreparation.prepare(nextSnapshot)
    const x = rect.left + rect.width / 2
    const width = Math.min(TOUR_MENU_WIDTH, window.innerWidth - 16)
    const place = (height: number) => {
      // На мобильном меню обычно над выделением; у верха страницы места нет — тогда под ним.
      const fitsAbove = rect.top - 12 - height >= 8
      menu.placement = menu.mode === 'mobile' && fitsAbove ? 'above' : 'below'
      showMenu(x, menu.placement === 'above' ? rect.top - 12 : rect.bottom + 8, height, width)
    }
    place(menuHeight())
    void nextTick(() => {
      // Подпись переносится по-разному: досчитываем по настоящей высоте.
      const height = menuElement.value?.offsetHeight
      if (height) place(height)
      menuElement.value?.focus()
    })
  }, 450)
})

watch(askAiProvider, () => {
  if (!menu.visible || !snapshot.value) return
  void actionPreparation.prepare(snapshot.value)
})

async function queueAvailablePageContext(): Promise<void> {
  await nextTick()
  if (document.querySelector('.vp-doc [data-kpo-ask-block-id]')) {
    contextLoader.queuePrefetch()
  }
}

function onContextMenu(event: MouseEvent): void {
  if (event.shiftKey) return
  const nextSnapshot = createSelectionSnapshot(event.target)
  if (!nextSnapshot) return

  event.preventDefault()
  snapshot.value = nextSnapshot
  menu.mode = 'desktop'
  menu.placement = 'below'
  keyboardMenuInitiator = event.button === 2 ? null : activeFocusTarget()
  void actionPreparation.prepare(nextSnapshot)
  showMenu(event.clientX, event.clientY, menuHeight())
  if (keyboardMenuInitiator) void nextTick(() => menuElement.value?.focus())
}

function onSelectionChange(): void {
  clearMobileSelectionTimer()
  // Выделение демонстрации ставит сам тур; любое касание закрывает его.
  if (!isMobileLike() || touring.value) return

  mobileSelectionTimer = window.setTimeout(() => {
    const nextSnapshot = createSelectionSnapshot(document.activeElement)
    if (!nextSnapshot) return
    const rect = selectedRangeRect()
    if (!rect) return

    snapshot.value = nextSnapshot
    menu.mode = 'mobile'
    menu.placement = 'above'
    void actionPreparation.prepare(nextSnapshot)
    showMenu(rect.left + rect.width / 2, rect.top - 12, menuHeight())
  }, 220)
}

function onPointerUp(): void {
  if (isMobileLike()) onSelectionChange()
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target
  if (target instanceof Element && target.closest('.kpo-ai-menu, .kpo-ai-manual')) return
  closeMenu(true)
}

function onKeydown(event: KeyboardEvent): void {
  if (handleDialogKeydown(event)) return
  if (event.key === 'Escape') {
    closeMenu(true)
    return
  }
  if (isScrollIntentKey(event)) closeMenuWithoutRestore()
}

function onScrollIntent(): void {
  closeMenuWithoutRestore()
}

function isScrollIntentKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  ) {
    return false
  }
  return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)
}

async function askAi(): Promise<void> {
  const prepared = preparedAction.value
  const restoreFocusTarget = keyboardMenuInitiator ?? visibleProviderControl()
  hideMenu()
  keyboardMenuInitiator = null
  if (!prepared) return
  clipboardFallback.setRestoreFocusTarget(restoreFocusTarget)

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

async function suggestFix(): Promise<void> {
  const current = snapshot.value
  const sourcePath = editableSourcePath.value
  closeMenuWithoutRestore()
  if (!current || !sourcePath) return

  const fragment = current.searchText ?? current.selectedText
  // Копирование стартует до открытия вкладки: после window.open документ
  // теряет фокус, и Clipboard API отказывает.
  const copied = fragment ? copyPromptToClipboard(fragment) : null
  const openedWindow = openBlankWindow()
  const ok = copied ? (await copied).ok : false
  navigateOpenedWindow(openedWindow, githubEditUrl(SITE.repository, sourcePath))
  showToast(
    !fragment
      ? 'Код изменён в Playground: найдите исходный пример в редакторе'
      : ok
        ? 'Фрагмент скопирован: найдите его в редакторе через Ctrl+F'
        : 'Найдите фрагмент в редакторе через Ctrl+F',
    5000
  )
}

async function reportProblem(): Promise<void> {
  const current = snapshot.value
  const sourcePath = editableSourcePath.value
  closeMenuWithoutRestore()
  if (!current || !sourcePath) return

  const openedWindow = openBlankWindow()
  const lines = await sourceLinesFor(current)
  navigateOpenedWindow(
    openedWindow,
    githubIssueUrl(SITE.repository, {
      pageTitle: page.value.title || site.value.title,
      pageUrl: `${SITE.origin}${route.path}${headingAnchorFor(current.currentBlockId)}`,
      quote: current.selectedText,
      sourcePath,
      lines
    })
  )
}

/** Строки исходника берутся из контекста Ask AI; без него issue обходится ссылкой на файл. */
async function sourceLinesFor(current: SelectionSnapshot): Promise<SourceLines | undefined> {
  try {
    const context = await contextLoader.loadPageContext()
    const blocks = context.blocks.filter(
      (block) => current.blockIds.includes(block.id) && block.lineStart > 0
    )
    const offset = context.sourceLineOffset
    if (blocks.length === 0 || offset === undefined) return undefined
    return {
      start: offset + Math.min(...blocks.map((block) => block.lineStart)),
      end: offset + Math.max(...blocks.map((block) => block.lineEnd))
    }
  } catch {
    return undefined
  }
}

function headingAnchorFor(blockId: string): string {
  const content = document.querySelector('.vp-doc')
  if (!content) return ''
  const block = [...content.querySelectorAll<HTMLElement>('[data-kpo-ask-block-id]')].find(
    (element) => element.dataset.kpoAskBlockId === blockId
  )
  if (!block) return ''

  let anchor = ''
  for (const heading of content.querySelectorAll<HTMLElement>('h2[id], h3[id]')) {
    const precedes =
      heading === block ||
      Boolean(heading.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING)
    if (!precedes) break
    anchor = heading.id
  }
  return anchor ? `#${encodeURIComponent(anchor)}` : ''
}

/** Первые слова первого обычного абзаца: на них показываем, как вызвать меню. */
function tourPhraseRange(): { target: HTMLElement; range: Range } | null {
  for (const paragraph of document.querySelectorAll<HTMLElement>('.vp-doc p')) {
    if (paragraph.closest('.custom-block, .kpo-switcher, table, li')) continue
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const words = [...(node.textContent ?? '').matchAll(/\S+/g)]
      if (words.length < 6) continue
      const first = words[0]
      const last = words[3]
      const range = document.createRange()
      range.setStart(node, first.index)
      range.setEnd(node, last.index + last[0].length)
      return { target: paragraph, range }
    }
  }
  return null
}

function menuHeight(): number {
  const items = editableSourcePath.value ? 3 : 1
  return 8 + items * 34 + (items > 1 ? 9 : 0) + (touring.value ? 140 : 0)
}

function finishTour(): void {
  closeMenuWithoutRestore()
  window.getSelection()?.removeAllRanges()
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clearTourTimer(): void {
  if (tourTimer !== null) window.clearTimeout(tourTimer)
  tourTimer = null
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

function visibleProviderControl(): HTMLElement | null {
  const selectors = ['.KpoAskAiProvider > button', '.KpoNavBarExtra > button', '.VPNavBarHamburger']
  for (const selector of selectors) {
    const control = document.querySelector<HTMLElement>(selector)
    if (control?.offsetParent !== null) return control
  }
  return null
}

function activeFocusTarget(): HTMLElement | null {
  return document.activeElement instanceof HTMLElement ? document.activeElement : null
}

function closeMenu(restoreFocus: boolean): void {
  const target = keyboardMenuInitiator
  hideMenu()
  keyboardMenuInitiator = null
  if (restoreFocus && target?.isConnected) target.focus()
}

function closeMenuWithoutRestore(): void {
  closeMenu(false)
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

function showToast(message: string, duration = 2200): void {
  clearToast()
  toast.value = message
  toastTimer = window.setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, duration)
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
      ref="menuElement"
      class="kpo-ai-menu"
      :class="{
        'kpo-ai-menu--mobile': menu.mode === 'mobile',
        'kpo-ai-menu--below': menu.mode === 'mobile' && menu.placement === 'below',
        'kpo-ai-menu--tour': touring
      }"
      :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
      role="menu"
      tabindex="-1"
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
      <template v-if="editableSourcePath">
        <div class="kpo-ai-menu__divider" role="separator" />
        <button
          type="button"
          class="kpo-ai-menu__action"
          role="menuitem"
          data-kpo-suggest="fix"
          @click="suggestFix"
        >
          {{ menu.mode === 'mobile' ? 'Исправить' : 'Исправить фрагмент' }}
        </button>
        <button
          type="button"
          class="kpo-ai-menu__action"
          role="menuitem"
          data-kpo-suggest="report"
          @click="reportProblem"
        >
          {{ menu.mode === 'mobile' ? 'Сообщить' : 'Сообщить об ошибке' }}
        </button>
      </template>
      <div v-if="touring" class="kpo-ai-menu__tour">
        <p v-if="menu.mode === 'mobile'">Выделите текст, и это меню появится само.</p>
        <p v-else>Выделите текст и щёлкните по нему правой кнопкой мыши: откроется это меню.</p>
        <p class="kpo-ai-menu__tour-sub">
          «Исправить» откроет файл страницы в редакторе GitHub, «Сообщить» — готовый issue с
          цитатой.
        </p>
        <button type="button" class="kpo-ai-menu__tour-close" @click="finishTour">Понятно</button>
      </div>
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
