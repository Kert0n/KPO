import type { Router } from 'vitepress'
import { CONTENT_LAYOUT_TOKENS } from './contentLayoutTokens'
import { countTableColumns, resolveAdaptiveTableMode, type AdaptiveTableMode } from './adaptiveTableModel'

const TABLE_BLOCK_SELECTOR = '.kpo-content-block--table'
const TABLE_MODE_CLASSES = ['kpo-table--fit', 'kpo-table--wrap', 'kpo-table--scroll'] as const

type AdaptiveTableController = {
  block: HTMLElement
  table: HTMLTableElement
  observer: ResizeObserver
  frame: number | null
}

type AdaptiveTableInstallState = {
  controllers: WeakMap<HTMLElement, AdaptiveTableController>
  scanFrame: number | null
}

let installState: AdaptiveTableInstallState | null = null

export function installAdaptiveTables(router?: Router): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const state = installState ?? {
    controllers: new WeakMap<HTMLElement, AdaptiveTableController>(),
    scanFrame: null
  }
  installState = state

  const scan = () => scheduleScan(state)
  scan()

  const previousAfterRouteChanged = router?.onAfterRouteChanged
  if (router) {
    router.onAfterRouteChanged = async (to) => {
      await previousAfterRouteChanged?.(to)
      scan()
    }
  }
}

function scheduleScan(state: AdaptiveTableInstallState): void {
  if (state.scanFrame !== null) {
    window.cancelAnimationFrame(state.scanFrame)
  }

  state.scanFrame = window.requestAnimationFrame(() => {
    state.scanFrame = null
    scanTables(state)
  })
}

function scanTables(state: AdaptiveTableInstallState): void {
  const blocks = [...document.querySelectorAll<HTMLElement>(TABLE_BLOCK_SELECTOR)]

  for (const block of blocks) {
    if (state.controllers.has(block)) {
      scheduleTableLayout(state.controllers.get(block)!)
      continue
    }

    const table = block.querySelector<HTMLTableElement>(':scope > table')
    if (!table) continue

    const controller: AdaptiveTableController = {
      block,
      table,
      observer: new ResizeObserver(() => scheduleTableLayout(controller)),
      frame: null
    }

    state.controllers.set(block, controller)
    controller.observer.observe(block)
    scheduleTableLayout(controller)
  }
}

function scheduleTableLayout(controller: AdaptiveTableController): void {
  if (controller.frame !== null) {
    window.cancelAnimationFrame(controller.frame)
  }

  controller.frame = window.requestAnimationFrame(() => {
    controller.frame = null
    applyAdaptiveTableLayout(controller)
  })
}

function applyAdaptiveTableLayout(controller: AdaptiveTableController): void {
  const { block, table } = controller
  const containerWidth = block.clientWidth
  const columnCount = countTableColumns(table)

  setTableMode(block, null)
  const naturalTableWidth = table.scrollWidth
  const mode = resolveAdaptiveTableMode({
    containerWidth,
    naturalTableWidth,
    columnCount,
    minReadableColumnWidth: CONTENT_LAYOUT_TOKENS.tableDenseMinColumnWidth,
    epsilon: CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
  })

  setTableMode(block, mode)

  if (mode !== 'wrap') return

  window.requestAnimationFrame(() => {
    const hasWrappedOverflow = block.scrollWidth > block.clientWidth + CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
    if (hasWrappedOverflow) {
      setTableMode(block, 'scroll')
    }
  })
}

function setTableMode(block: HTMLElement, mode: AdaptiveTableMode | null): void {
  block.classList.remove(...TABLE_MODE_CLASSES)
  if (mode) {
    block.classList.add(`kpo-table--${mode}`)
    block.dataset.kpoTableMode = mode
  } else {
    delete block.dataset.kpoTableMode
  }
}
