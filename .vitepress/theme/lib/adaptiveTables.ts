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
  settleFrame: number | null
}

type AdaptiveTableInstallState = {
  controllers: Map<HTMLElement, AdaptiveTableController>
  scanFrame: number | null
  disposed: boolean
}

export type AdaptiveTablesController = {
  scan(): void
  disposeDisconnected(): void
  dispose(): void
}

let installedController: AdaptiveTablesController | null = null

export function installAdaptiveTables(router?: Router): AdaptiveTablesController | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null

  installedController?.dispose()

  const state: AdaptiveTableInstallState = {
    controllers: new Map<HTMLElement, AdaptiveTableController>(),
    scanFrame: null,
    disposed: false
  }

  const previousAfterRouteChanged = router?.onAfterRouteChanged
  const afterRouteChanged = async (to: string) => {
    await previousAfterRouteChanged?.(to)
    controller.scan()
  }

  const controller: AdaptiveTablesController = {
    scan() {
      if (!state.disposed) scheduleScan(state)
    },
    disposeDisconnected() {
      if (!state.disposed) disposeDisconnectedTables(state)
    },
    dispose() {
      if (state.disposed) return
      state.disposed = true
      if (state.scanFrame !== null) window.cancelAnimationFrame(state.scanFrame)
      state.scanFrame = null
      for (const tableController of state.controllers.values()) disposeTableController(tableController)
      state.controllers.clear()
      if (router?.onAfterRouteChanged === afterRouteChanged) {
        router.onAfterRouteChanged = previousAfterRouteChanged
      }
      if (installedController === controller) installedController = null
    }
  }

  if (router) {
    router.onAfterRouteChanged = afterRouteChanged
  }

  installedController = controller
  controller.scan()
  return controller
}

function scheduleScan(state: AdaptiveTableInstallState): void {
  if (state.scanFrame !== null) {
    window.cancelAnimationFrame(state.scanFrame)
  }

  state.scanFrame = window.requestAnimationFrame(() => {
    if (state.disposed) return
    state.scanFrame = null
    scanTables(state)
  })
}

function scanTables(state: AdaptiveTableInstallState): void {
  disposeDisconnectedTables(state)
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
      frame: null,
      settleFrame: null
    }

    state.controllers.set(block, controller)
    controller.observer.observe(block)
    scheduleTableLayout(controller)
  }
}

function disposeDisconnectedTables(state: AdaptiveTableInstallState): void {
  for (const [block, controller] of state.controllers) {
    if (document.contains(block)) continue
    disposeTableController(controller)
    state.controllers.delete(block)
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

  if (controller.settleFrame !== null) window.cancelAnimationFrame(controller.settleFrame)
  controller.settleFrame = window.requestAnimationFrame(() => {
    controller.settleFrame = null
    if (!controller.block.isConnected) return
    const hasWrappedOverflow =
      block.scrollWidth > block.clientWidth + CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
    if (hasWrappedOverflow) {
      setTableMode(block, 'scroll')
    }
  })
}

function disposeTableController(controller: AdaptiveTableController): void {
  if (controller.frame !== null) window.cancelAnimationFrame(controller.frame)
  if (controller.settleFrame !== null) window.cancelAnimationFrame(controller.settleFrame)
  controller.frame = null
  controller.settleFrame = null
  controller.observer.disconnect()
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
