import { onBeforeUnmount, onMounted } from 'vue'
import { readPlaygroundSelection } from '../../lib/playgroundRegistry'

export type SelectionSnapshot = {
  selectedText: string
  blockIds: string[]
  playgroundBlockId: string
}

type SelectionMode = 'desktop' | 'mobile'

export function useTextSelection(options: {
  onSelection: (snapshot: SelectionSnapshot, position: { x: number; y: number }, mode: SelectionMode) => void
}) {
  let mobileSelectionTimer: number | null = null

  function onContextMenu(event: MouseEvent): void {
    if (event.shiftKey) return
    const snapshot = createSelectionSnapshot(event.target)
    if (!snapshot) return
    event.preventDefault()
    options.onSelection(snapshot, { x: event.clientX, y: event.clientY }, 'desktop')
  }

  function onSelectionChange(): void {
    clearMobileSelectionTimer()
    if (!isMobileLike()) return
    // The debounce is part of the mobile-selection contract: browsers emit
    // several intermediate selectionchange events while handles are moving.
    mobileSelectionTimer = window.setTimeout(() => {
      const snapshot = createSelectionSnapshot(document.activeElement)
      const rect = snapshot ? selectedRangeRect() : null
      if (!snapshot || !rect) return
      options.onSelection(snapshot, { x: rect.left + rect.width / 2, y: rect.top - 12 }, 'mobile')
    }, 220)
  }

  function clearMobileSelectionTimer(): void {
    if (mobileSelectionTimer !== null) window.clearTimeout(mobileSelectionTimer)
    mobileSelectionTimer = null
  }

  onMounted(() => {
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('pointerup', onSelectionChange)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('contextmenu', onContextMenu)
    document.removeEventListener('selectionchange', onSelectionChange)
    document.removeEventListener('pointerup', onSelectionChange)
    clearMobileSelectionTimer()
  })
}

function createSelectionSnapshot(target: EventTarget | null): SelectionSnapshot | null {
  const targetElement = target instanceof Element ? target : null
  const playgroundBlockId = closestPlaygroundBlockId(targetElement)
  const playgroundSelection = playgroundBlockId ? readPlaygroundSelection(playgroundBlockId) : ''
  if (playgroundSelection) {
    return { selectedText: playgroundSelection, blockIds: [playgroundBlockId], playgroundBlockId }
  }

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const selectedText = selection.toString().trim()
  const content = document.querySelector('.vp-doc')
  if (!selectedText || !content || !selectionBelongsToContent(selection, content)) return null
  const blockIds = selectedBlockIds(selection, content)
  return blockIds.length > 0 ? { selectedText, blockIds, playgroundBlockId } : null
}

function selectedBlockIds(selection: Selection, content: Element): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const blocks = [...content.querySelectorAll<HTMLElement>('[data-kpo-ask-block-id]')]
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const ancestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement
    const closest = ancestor?.closest<HTMLElement>('[data-kpo-ask-block-id]')
    if (closest?.dataset.kpoAskBlockId) addId(ids, seen, closest.dataset.kpoAskBlockId)
    for (const block of blocks) {
      if (range.intersectsNode(block) && block.dataset.kpoAskBlockId) {
        addId(ids, seen, block.dataset.kpoAskBlockId)
      }
    }
  }
  return ids
}

function selectionBelongsToContent(selection: Selection, content: Element): boolean {
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const node = selection.getRangeAt(index).commonAncestorContainer
    const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
    if (element && content.contains(element)) return true
  }
  return false
}

function selectedRangeRect(): DOMRect | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const rect = selection.getRangeAt(0).getBoundingClientRect()
  return rect.width === 0 && rect.height === 0 ? null : rect
}

function closestPlaygroundBlockId(element: Element | null): string {
  const block = element?.closest<HTMLElement>('.kpo-switcher[data-kpo-ask-block-id]')
  return block?.querySelector('.kpo-playground') ? (block.dataset.kpoAskBlockId ?? '') : ''
}

function isMobileLike(): boolean {
  return window.matchMedia('(max-width: 767px), (pointer: coarse)').matches
}

function addId(ids: string[], seen: Set<string>, id: string): void {
  if (!seen.has(id)) {
    seen.add(id)
    ids.push(id)
  }
}
