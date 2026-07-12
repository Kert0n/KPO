import { readPlaygroundCode, readPlaygroundSelection } from '../lib/playgroundRegistry'

export type SelectionSnapshot = {
  selectedText: string
  blockIds: string[]
  playgroundBlockId: string
}

type ContentSelection = {
  selectedText: string
  blockIds: string[]
  ranges: Range[]
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

    const content = document.querySelector('.vp-doc')
    if (!content) return null
    const contentSelection = collectSelectionWithinContent(selection, content)
    if (!contentSelection) return null

    return {
      selectedText: contentSelection.selectedText,
      blockIds: contentSelection.blockIds,
      playgroundBlockId: playgroundBlockId || ''
    }
  }

  function selectedRangeRect(): DOMRect | null {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null
    const content = document.querySelector('.vp-doc')
    if (!content) return null
    const contentSelection = collectSelectionWithinContent(selection, content)
    const rect = contentSelection?.ranges[0]?.getBoundingClientRect()
    if (!rect) return null
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

function collectSelectionWithinContent(
  selection: Selection,
  content: Element
): ContentSelection | null {
  const contentRange = document.createRange()
  contentRange.selectNodeContents(content)

  const ranges: Range[] = []
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const clipped = clippedRange(selection.getRangeAt(index), contentRange)
    if (!clipped?.toString().trim()) continue
    ranges.push(clipped)
  }

  if (ranges.length === 0) return null

  const orderedRanges = ranges.sort((left, right) => {
    return left.compareBoundaryPoints(Range.START_TO_START, right)
  })

  const selectedText = orderedRanges
    .map((range) => range.toString())
    .join('\n')
    .trim()
  if (!selectedText) return null

  const blockIds = selectedBlockIds(orderedRanges, content)
  if (blockIds.length === 0) return null

  return { selectedText, blockIds, ranges: orderedRanges }
}

function selectedBlockIds(ranges: Range[], content: Element): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const blocks = [...content.querySelectorAll<HTMLElement>('[data-kpo-ask-block-id]')]

  for (const block of blocks) {
    for (const range of ranges) {
      const intersection = intersectElement(range, block)
      if (!intersection?.toString().trim()) continue
      const id = block.dataset.kpoAskBlockId
      if (id) addId(ids, seen, id)
      break
    }
  }
  return ids
}

function intersectElement(range: Range, element: Element): Range | null {
  const elementRange = document.createRange()
  elementRange.selectNodeContents(element)
  return clippedRange(range, elementRange)
}

function clippedRange(range: Range, bounds: Range): Range | null {
  if (!rangesOverlap(range, bounds)) return null

  const clipped = range.cloneRange()
  if (range.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) {
    clipped.setStart(bounds.startContainer, bounds.startOffset)
  }
  if (range.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) {
    clipped.setEnd(bounds.endContainer, bounds.endOffset)
  }
  return clipped.collapsed ? null : clipped
}

function rangesOverlap(range: Range, bounds: Range): boolean {
  return (
    range.compareBoundaryPoints(Range.END_TO_START, bounds) < 0 &&
    range.compareBoundaryPoints(Range.START_TO_END, bounds) > 0
  )
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
