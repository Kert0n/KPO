import type { Plugin } from 'vite'

/**
 * Стабильная доступная подпись переключателя темы. Штатная кнопка VitePress
 * называет себя через меняющийся title («Тёмная тема» / «Светлая тема»), поэтому
 * подпись добавляется прямо в шаблон компонента: так она одинакова в dev, в SSR
 * и после гидрации, в навбаре и в меню «⋯».
 */
export const APPEARANCE_SWITCH_LABEL = 'Переключить тему'

const MARKER = 'class="VPSwitchAppearance"'

export function labelAppearanceSwitch(source: string): string {
  if (!source.includes(MARKER)) {
    throw new Error(
      'VPSwitchAppearance.vue no longer contains class="VPSwitchAppearance": update appearanceSwitchLabel.ts'
    )
  }
  return source.replace(MARKER, `${MARKER}\n    aria-label="${APPEARANCE_SWITCH_LABEL}"`)
}

export function appearanceSwitchLabelPlugin(): Plugin {
  return {
    name: 'kpo-appearance-switch-label',
    enforce: 'pre',
    transform(code, id) {
      const [file, query] = id.split('?')
      if (query || !file.endsWith('/VPSwitchAppearance.vue')) return null
      return labelAppearanceSwitch(code)
    }
  }
}
