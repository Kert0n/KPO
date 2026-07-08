import type { Router } from 'vitepress'

const STORAGE_KEY = 'kpo:pending-search-highlight'
const HIT_CLASS = 'kpo-search-hit'
const ACTIVE_HIT_CLASS = 'kpo-search-hit--active'
const MAX_QUERY_AGE_MS = 10_000
const SEARCH_RESULT_SELECTOR = '.VPLocalSearchBox a.result'
const SEARCH_INPUT_SELECTOR = '.VPLocalSearchBox .search-input'
const DOC_SELECTOR = '.vp-doc'
const EXCLUDED_ANCESTOR_SELECTOR = [
  'script',
  'style',
  '.header-anchor',
  '.kpo-mermaid svg',
  `.${HIT_CLASS}`
].join(',')

type PendingSearchHighlight = {
  query: string
  createdAt: number
}

let installed = false

export function installSearchResultHighlight(router?: Router): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || installed) return
  installed = true

  document.addEventListener('click', captureSearchClick, true)
  document.addEventListener('keydown', captureSearchEnter, true)

  const previousAfterRouteChanged = router?.onAfterRouteChanged
  if (router) {
    router.onAfterRouteChanged = async (to) => {
      await previousAfterRouteChanged?.(to)
      schedulePendingHighlight()
    }
  }

  schedulePendingHighlight()
}

export function tokenizeSearchQuery(query: string): string[] {
  const seen = new Set<string>()
  const terms: string[] = []

  for (const rawTerm of query.trim().split(/\s+/)) {
    const term = rawTerm.trim()
    if (term.length < 2) continue

    const key = term.toLocaleLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    terms.push(term)
  }

  return terms
}

export function clearSearchHighlights(root: ParentNode): void {
  const marks = [...root.querySelectorAll<HTMLElement>(`.${HIT_CLASS}`)]
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    mark.replaceWith(document.createTextNode(mark.textContent ?? ''))
    parent.normalize()
  }
}

export function highlightSearchTerms(root: ParentNode, terms: string[]): number {
  clearSearchHighlights(root)
  if (terms.length === 0) return 0

  const regex = new RegExp(terms.map(escapeRegExp).join('|'), 'gi')
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest(EXCLUDED_ANCESTOR_SELECTOR)) return NodeFilter.FILTER_REJECT
      if (isHiddenFromLayout(parent, root)) return NodeFilter.FILTER_REJECT
      if (!node.nodeValue || !regex.test(node.nodeValue)) return NodeFilter.FILTER_REJECT
      regex.lastIndex = 0
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const textNodes: Text[] = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }

  let count = 0
  for (const node of textNodes) {
    count += replaceTextNodeMatches(node, regex)
  }

  const firstHit = root.querySelector<HTMLElement>(`.${HIT_CLASS}`)
  firstHit?.classList.add(ACTIVE_HIT_CLASS)

  return count
}

function captureSearchClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return
  if (!event.target.closest(SEARCH_RESULT_SELECTOR)) return
  persistCurrentSearchQuery()
}

function captureSearchEnter(event: KeyboardEvent): void {
  if (event.key !== 'Enter') return
  if (!(event.target instanceof Element)) return
  if (!event.target.closest('.VPLocalSearchBox')) return
  persistCurrentSearchQuery()
}

function persistCurrentSearchQuery(): void {
  const input = document.querySelector<HTMLInputElement>(SEARCH_INPUT_SELECTOR)
  const query = input?.value.trim() ?? ''
  if (!query) return

  try {
    const pending: PendingSearchHighlight = { query, createdAt: Date.now() }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // Highlighting is a progressive enhancement; ignore storage failures.
  }
}

function schedulePendingHighlight(): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      applyPendingHighlight()
    })
  })
}

function applyPendingHighlight(): void {
  const pending = readPendingHighlight()
  const root = document.querySelector<HTMLElement>(DOC_SELECTOR)
  if (!root) return

  clearSearchHighlights(root)
  if (!pending) return

  const terms = tokenizeSearchQuery(pending.query)
  const count = highlightSearchTerms(root, terms)
  clearPendingHighlight()

  if (count === 0 || window.location.hash) return
  root.querySelector<HTMLElement>(`.${ACTIVE_HIT_CLASS}`)?.scrollIntoView({
    block: 'center',
    inline: 'nearest'
  })
}

function readPendingHighlight(): PendingSearchHighlight | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PendingSearchHighlight>
    if (typeof parsed.query !== 'string' || typeof parsed.createdAt !== 'number') {
      clearPendingHighlight()
      return null
    }

    if (Date.now() - parsed.createdAt > MAX_QUERY_AGE_MS) {
      clearPendingHighlight()
      return null
    }

    return { query: parsed.query, createdAt: parsed.createdAt }
  } catch {
    clearPendingHighlight()
    return null
  }
}

function clearPendingHighlight(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function replaceTextNodeMatches(node: Text, regex: RegExp): number {
  const value = node.nodeValue ?? ''
  const fragment = document.createDocumentFragment()
  let lastIndex = 0
  let count = 0

  regex.lastIndex = 0
  for (const match of value.matchAll(regex)) {
    const index = match.index ?? 0
    const text = match[0]
    if (!text) continue

    if (index > lastIndex) {
      fragment.append(document.createTextNode(value.slice(lastIndex, index)))
    }

    const mark = document.createElement('mark')
    mark.className = HIT_CLASS
    mark.textContent = text
    fragment.append(mark)

    lastIndex = index + text.length
    count += 1
  }

  if (lastIndex < value.length) {
    fragment.append(document.createTextNode(value.slice(lastIndex)))
  }

  node.replaceWith(fragment)
  return count
}

function isHiddenFromLayout(element: Element, root: ParentNode): boolean {
  let current: Element | null = element

  while (current && current !== root) {
    if (current instanceof HTMLElement) {
      if (current.hidden || current.getAttribute('aria-hidden') === 'true') return true

      const style = getComputedStyle(current)
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
        return true
      }
    }

    current = current.parentElement
  }

  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
