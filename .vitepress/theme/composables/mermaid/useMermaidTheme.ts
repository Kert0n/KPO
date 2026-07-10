import { createMermaidConfig } from '../../lib/mermaidThemeModel'

export function useMermaidTheme() {
  function currentConfig() {
    const style = getComputedStyle(document.documentElement)
    const fontFamily =
      style.getPropertyValue('--vp-font-family-base').trim() ||
      'Inter Variable, Inter, ui-sans-serif, system-ui, sans-serif'

    return createMermaidConfig({
      fontFamily,
      background: cssVariable(style, '--vp-c-bg'),
      softBackground: cssVariable(style, '--vp-c-bg-soft'),
      text: cssVariable(style, '--vp-c-text-1'),
      mutedText: cssVariable(style, '--vp-c-text-2'),
      border: cssVariable(style, '--vp-c-border')
    })
  }

  return { currentConfig }
}

function cssVariable(style: CSSStyleDeclaration, property: string, fallback = ''): string {
  return style.getPropertyValue(property).trim() || fallback
}
