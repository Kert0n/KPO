/**
 * Единый источник цветов проекта.
 *
 * Палитры кода следуют редакторским схемам JetBrains:
 * светлая — IntelliJ Light, тёмная — Darcula.
 * Из этих констант собираются и Shiki-темы (статическая подсветка),
 * и CSS-переменные для CodeMirror (Kotlin Playground) — поэтому
 * статический код и playground всегда окрашены одинаково.
 */

export type CodePalette = {
  bg: string
  fg: string
  keyword: string
  string: string
  number: string
  comment: string
  function: string
  annotation: string
  field: string
  type: string
  constant: string
  lineNumber: string
  selection: string
  cursor: string
}

export const lightCode: CodePalette = {
  bg: '#ffffff',
  fg: '#080808',
  keyword: '#0033b3',
  string: '#067d17',
  number: '#1750eb',
  comment: '#8c8c8c',
  function: '#00627a',
  annotation: '#9e880d',
  field: '#871094',
  type: '#000000',
  constant: '#871094',
  lineNumber: '#adadad',
  selection: '#a6d2ff',
  cursor: '#000000'
}

export const darkCode: CodePalette = {
  bg: '#1e1f22',
  fg: '#bcbec4',
  keyword: '#cf8e6d',
  string: '#6aab73',
  number: '#2aacb8',
  comment: '#7a7e85',
  function: '#56a8f5',
  annotation: '#b3ae60',
  field: '#c77dbb',
  type: '#bcbec4',
  constant: '#c77dbb',
  lineNumber: '#4b5059',
  selection: '#214283',
  cursor: '#ced0d6'
}
