export type AdaptiveTableMode = 'fit' | 'wrap' | 'scroll'

export type ResolveAdaptiveTableModeInput = {
  containerWidth: number
  naturalTableWidth: number
  columnCount: number
  minReadableColumnWidth: number
  epsilon?: number
}

export function resolveAdaptiveTableMode(input: ResolveAdaptiveTableModeInput): AdaptiveTableMode {
  const epsilon = input.epsilon ?? 0

  if (
    input.containerWidth <= 0 ||
    input.naturalTableWidth <= 0 ||
    input.columnCount <= 0 ||
    input.minReadableColumnWidth <= 0
  ) {
    return 'scroll'
  }

  if (input.naturalTableWidth <= input.containerWidth + epsilon) {
    return 'fit'
  }

  if (input.containerWidth / input.columnCount >= input.minReadableColumnWidth) {
    return 'wrap'
  }

  return 'scroll'
}

export function countTableColumns(table: HTMLTableElement): number {
  const row = table.tHead?.rows.item(0) ?? table.rows.item(0)
  if (!row) return 0

  return [...row.cells].reduce((count, cell) => {
    return count + Math.max(1, cell.colSpan || 1)
  }, 0)
}
