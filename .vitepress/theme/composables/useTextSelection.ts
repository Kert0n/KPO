import { readPlaygroundSelection } from '../lib/playgroundRegistry'
import { playgroundOverride } from '../lib/askAiSelectionSnapshot'
import type { AskAiBlockKind } from '../../shared/core/askAiIds'
import type { AskAiCurrentOverride } from '../lib/askAiModel'

export type SelectionSnapshot = {
  selectedText: string
  blockIds: string[]
  currentBlockId: string
  currentBlockKind?: AskAiBlockKind
  activeLanguage?: string
  currentOverride?: AskAiCurrentOverride
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
      const currentOverride = playgroundOverride(playgroundBlockId)
      return {
        selectedText: playgroundSelection,
        blockIds: [playgroundBlockId],
        currentBlockId: playgroundBlockId,
        currentBlockKind: 'playground',
        activeLanguage: 'kotlin',
        currentOverride
      }
    }

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const content = document.querySelector('.vp-doc')
    if (!content) return null
    const contentSelection = collectSelectionWithinContent(selection, content)
    if (!contentSelection) return null

    const currentBlockId = contentSelection.blockIds[0] ?? ''
    const currentElement = currentBlockId
      ? closestBlockElement(targetElement, currentBlockId, content)
      : null
    const currentOverride = captureCodeOverride(currentElement)
    return {
      selectedText: contentSelection.selectedText,
      blockIds: contentSelection.blockIds,
      currentBlockId,
      currentBlockKind: currentOverride?.kind ?? contentBlockKind(currentElement),
      activeLanguage: currentOverride?.language,
      currentOverride
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

function captureCodeOverride(element: Element | null): AskAiCurrentOverride | undefined {
  const switcher =
    element?.closest<HTMLElement>('.kpo-switcher') ??
    element?.querySelector<HTMLElement>('.kpo-switcher')
  if (!switcher || switcher.querySelector('.kpo-playground:not([style*="display: none"])')) {
    return undefined
  }

  const active = switcher.querySelector<HTMLElement>(
    '.kpo-switcher__blocks > [class*="language-"].active'
  )
  const code = active?.querySelector('code')?.textContent?.replace(/\n$/, '')
  const language = active ? blockLanguage(active) : ''
  if (!active || !code || !language) return undefined
  return { kind: 'code', language, markdown: fencedCode(language, code) }
}

function closestBlockElement(
  target: Element | null,
  blockId: string,
  content: Element
): HTMLElement | null {
  const closest = target?.closest<HTMLElement>('[data-kpo-ask-block-id]')
  if (closest?.dataset.kpoAskBlockId === blockId) return closest
  return (
    [...content.querySelectorAll<HTMLElement>('[data-kpo-ask-block-id]')].find(
      (element) => element.dataset.kpoAskBlockId === blockId
    ) ?? null
  )
}

function contentBlockKind(element: Element | null): AskAiBlockKind | undefined {
  if (!element) return undefined
  if (element.matches('.kpo-switcher, .kpo-content-block--multi-code')) return 'multi-code'
  if (element.matches('.kpo-mermaid, .kpo-content-block--mermaid')) return 'mermaid'
  if (element.matches('.kpo-content-block--table')) return 'table'
  if (element.matches('.kpo-content-block--code')) return 'code'
  if (element.matches('.custom-block, .kpo-only')) return 'custom-container'
  if (element.matches('h1, h2, h3, h4, h5, h6')) return 'heading'
  if (element.matches('blockquote')) return 'blockquote'
  if (element.matches('ul, ol')) return 'list'
  if (element.matches('p')) return 'paragraph'
  return undefined
}

function blockLanguage(block: Element): string {
  for (const name of block.classList) {
    if (name.startsWith('language-')) return name.slice('language-'.length)
  }
  return ''
}

function fencedCode(language: string, code: string): string {
  const fence = code.includes('```') ? '````' : '```'
  return `${fence}${language}\n${code}\n${fence}`
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
