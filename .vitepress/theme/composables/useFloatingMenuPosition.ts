import { reactive } from 'vue'
import { clamp } from '../../shared/core/math'

export type FloatingMenuMode = 'desktop' | 'mobile'
/** above: y — нижний край меню (над выделением), below: y — верхний край */
export type FloatingMenuPlacement = 'above' | 'below'

export function useFloatingMenuPosition() {
  const menu = reactive({
    visible: false,
    x: 0,
    y: 0,
    mode: 'desktop' as FloatingMenuMode,
    placement: 'below' as FloatingMenuPlacement
  })

  /** Размер — ожидаемый: по нему меню удерживается внутри окна */
  function showMenu(x: number, y: number, height = 44, minWidth = 0): void {
    const width = Math.max(menu.mode === 'mobile' ? 112 : 220, minWidth)
    menu.x = clamp(x, 8 + width / 2, window.innerWidth - 8 - width / 2)
    menu.y =
      menu.placement === 'above'
        ? clamp(y, 8 + height, window.innerHeight - 8)
        : clamp(y, 8, window.innerHeight - 8 - height)
    menu.visible = true
  }

  function hideMenu(): void {
    menu.visible = false
  }

  return { menu, showMenu, hideMenu }
}
