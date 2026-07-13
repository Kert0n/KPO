import type { MermaidThemeTokens } from '../lib/mermaidThemeModel'

export function readMermaidThemeTokens(
  darkMode = document.documentElement.classList.contains('dark')
): MermaidThemeTokens {
  const style = getComputedStyle(document.documentElement)

  return {
    darkMode,
    fontFamily: cssVariable(style, '--vp-font-family-base', 'Inter Variable, Inter, sans-serif'),
    background: cssVariable(style, '--vp-c-bg'),
    softBackground: cssVariable(style, '--vp-c-bg-soft'),
    text: cssVariable(style, '--vp-c-text-1'),
    mutedText: cssVariable(style, '--vp-c-text-2'),
    border: cssVariable(style, '--vp-c-border')
  }
}

function cssVariable(style: CSSStyleDeclaration, property: string, fallback = ''): string {
  return style.getPropertyValue(property).trim() || fallback
}
