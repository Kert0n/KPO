import { readPlaygroundCode, readPlaygroundSelection } from '../lib/playgroundRegistry'

export type SelectionSnapshot = {
  selectedText: string
  blockIds: string[]
  playgroundBlockId: string
}

export function useTextSelection() {
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
    if (!selectedText) return null

    const content = document.querySelector('.vp-doc')
    if (!content || !selectionBelongsToContent(selection, content)) return null
    const blockIds = selectedBlockIds(selection, content)
    if (blockIds.length === 0) return null

    return { selectedText, blockIds, playgroundBlockId: playgroundBlockId || '' }
  }

  function selectedRangeRect(): DOMRect | null {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const rect = selection.getRangeAt(0).getBoundingClientRect()
    return rect.width === 0 && rect.height === 0 ? null : rect
  }

  return { createSelectionSnapshot, selectedRangeRect }
}

export function playgroundOverride(
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

function selectedBlockIds(selection: Selection, content: Element): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const blocks = [...content.querySelectorAll<HTMLElement>('[data-kpo-ask-block-id]')]

  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index)
    const ancestor = elementForNode(range.commonAncestorContainer)
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
    const container = elementForNode(selection.getRangeAt(index).commonAncestorContainer)
    if (container && content.contains(container)) return true
  }
  return false
}

function elementForNode(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
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
