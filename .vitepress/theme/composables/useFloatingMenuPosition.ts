import { reactive } from 'vue'
import { clamp } from '../../shared/core/math'

export type FloatingMenuMode = 'desktop' | 'mobile'

export function useFloatingMenuPosition() {
  const menu = reactive({ visible: false, x: 0, y: 0, mode: 'desktop' as FloatingMenuMode })

  function showMenu(x: number, y: number): void {
    const width = menu.mode === 'mobile' ? 112 : 220
    const height = 44
    menu.x = clamp(x, 8 + width / 2, window.innerWidth - 8 - width / 2)
    menu.y = clamp(y, 8, window.innerHeight - 8 - height)
    menu.visible = true
  }

  function hideMenu(): void {
    menu.visible = false
  }

  return { menu, showMenu, hideMenu }
}
