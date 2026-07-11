import type { Router } from 'vitepress'
import { CONTENT_LAYOUT_TOKENS } from './contentLayoutTokens'
import {
  countTableColumns,
  resolveAdaptiveTableMode,
  type AdaptiveTableMode
} from './adaptiveTableModel'

const TABLE_BLOCK_SELECTOR = '.kpo-content-block--table'
const TABLE_MODE_CLASSES = ['kpo-table--fit', 'kpo-table--wrap', 'kpo-table--scroll'] as const

export type AdaptiveTablesController = {
  scan(): void
  disposeDisconnected(): void
  dispose(): void
}

type TableController = {
  block: HTMLElement
  table: HTMLTableElement
  observer: ResizeObserver
  layoutFrame: number | null
  verificationFrame: number | null
  disposed: boolean
}

type AdaptiveTableInstallState = {
  controllers: Map<HTMLElement, TableController>
  scanFrame: number | null
  disposed: boolean
  router?: Router
  previousAfterRouteChanged?: Router['onAfterRouteChanged']
  installedAfterRouteChanged?: Router['onAfterRouteChanged']
}

let installedController: AdaptiveTablesController | null = null

export function installAdaptiveTables(router?: Router): AdaptiveTablesController | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined

  installedController?.dispose()

  const state: AdaptiveTableInstallState = {
    controllers: new Map(),
    scanFrame: null,
    disposed: false,
    router,
    previousAfterRouteChanged: router?.onAfterRouteChanged
  }

  const controller: AdaptiveTablesController = {
    scan: () => scheduleScan(state),
    disposeDisconnected: () => disposeDisconnected(state),
    dispose: () => disposeInstall(state, controller)
  }
  installedController = controller

  if (router) {
    const afterRouteChanged: NonNullable<Router['onAfterRouteChanged']> = async (to) => {
      await state.previousAfterRouteChanged?.(to)
      controller.scan()
    }
    state.installedAfterRouteChanged = afterRouteChanged
    router.onAfterRouteChanged = afterRouteChanged
  }

  controller.scan()
  return controller
}

function scheduleScan(state: AdaptiveTableInstallState): void {
  if (state.disposed) return
  if (state.scanFrame !== null) window.cancelAnimationFrame(state.scanFrame)

  state.scanFrame = window.requestAnimationFrame(() => {
    state.scanFrame = null
    if (!state.disposed) scanTables(state)
  })
}

function scanTables(state: AdaptiveTableInstallState): void {
  disposeDisconnected(state)
  const blocks = [...document.querySelectorAll<HTMLElement>(TABLE_BLOCK_SELECTOR)]

  for (const block of blocks) {
    const existing = state.controllers.get(block)
    if (existing) {
      scheduleTableLayout(existing)
      continue
    }

    const table = block.querySelector<HTMLTableElement>(':scope > table')
    if (!table) continue

    const observer = new ResizeObserver(() => scheduleTableLayout(tableController))
    const tableController: TableController = {
      block,
      table,
      observer,
      layoutFrame: null,
      verificationFrame: null,
      disposed: false
    }
    state.controllers.set(block, tableController)
    tableController.observer.observe(block)
    scheduleTableLayout(tableController)
  }
}

function disposeDisconnected(state: AdaptiveTableInstallState): void {
  for (const [block, controller] of state.controllers) {
    if (block.isConnected) continue
    disposeTableController(controller)
    state.controllers.delete(block)
  }
}

function scheduleTableLayout(controller: TableController): void {
  if (controller.disposed) return
  if (controller.layoutFrame !== null) window.cancelAnimationFrame(controller.layoutFrame)
  if (controller.verificationFrame !== null) {
    window.cancelAnimationFrame(controller.verificationFrame)
    controller.verificationFrame = null
  }

  controller.layoutFrame = window.requestAnimationFrame(() => {
    controller.layoutFrame = null
    if (!controller.disposed && controller.block.isConnected) applyAdaptiveTableLayout(controller)
  })
}

function applyAdaptiveTableLayout(controller: TableController): void {
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

  controller.verificationFrame = window.requestAnimationFrame(() => {
    controller.verificationFrame = null
    if (controller.disposed || !block.isConnected) return
    const hasWrappedOverflow =
      block.scrollWidth > block.clientWidth + CONTENT_LAYOUT_TOKENS.tableOverflowEpsilon
    if (hasWrappedOverflow) setTableMode(block, 'scroll')
  })
}

function disposeTableController(controller: TableController): void {
  controller.disposed = true
  controller.observer.disconnect()
  if (controller.layoutFrame !== null) window.cancelAnimationFrame(controller.layoutFrame)
  if (controller.verificationFrame !== null) {
    window.cancelAnimationFrame(controller.verificationFrame)
  }
  controller.layoutFrame = null
  controller.verificationFrame = null
}

function disposeInstall(state: AdaptiveTableInstallState, owner: AdaptiveTablesController): void {
  if (state.disposed) return
  state.disposed = true
  if (state.scanFrame !== null) window.cancelAnimationFrame(state.scanFrame)
  state.scanFrame = null

  for (const controller of state.controllers.values()) disposeTableController(controller)
  state.controllers.clear()

  if (state.router && state.router.onAfterRouteChanged === state.installedAfterRouteChanged) {
    state.router.onAfterRouteChanged = state.previousAfterRouteChanged
  }
  if (installedController === owner) installedController = null
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
