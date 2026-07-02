import { darkCode, lightCode, type CodePalette } from './palette'

/**
 * Генерирует CSS-переменные --kpo-code-* из общей палитры.
 * Строка попадает в <head> через config.mts, поэтому CodeMirror
 * (Kotlin Playground) и любой UI-код используют те же цвета,
 * что и Shiki-темы. Смена темы — чистый CSS, без JS.
 */
export function paletteCss(): string {
  return [
    `:root{${toVars(lightCode)}}`,
    `.dark{${toVars(darkCode)}}`
  ].join('\n')
}

function toVars(c: CodePalette): string {
  return Object.entries(c)
    .map(([token, color]) => `--kpo-code-${kebab(token)}:${color};`)
    .join('')
}

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}
