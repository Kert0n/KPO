import { nextTick, onBeforeUnmount, onMounted, reactive } from 'vue'
import { clamp } from '../../../shared/core/math'

export function useFloatingMenuPosition() {
  const menu = reactive({
    visible: false,
    x: 0,
    y: 0,
    mode: 'desktop' as 'desktop' | 'mobile'
  })
  let focusReturnElement: HTMLElement | null = null

  function showMenu(x: number, y: number, mode: 'desktop' | 'mobile'): void {
    rememberFocusReturnElement()
    menu.mode = mode
    const width = mode === 'mobile' ? 112 : 220
    menu.x = clamp(x, 8 + width / 2, window.innerWidth - 8 - width / 2)
    menu.y = clamp(y, 8, window.innerHeight - 52)
    menu.visible = true
    void nextTick(() => document.querySelector<HTMLButtonElement>('.kpo-ai-menu__item')?.focus())
  }

  function hideMenu(): void {
    menu.visible = false
  }

  function restoreFocus(): void {
    if (focusReturnElement?.isConnected) focusReturnElement.focus()
    focusReturnElement = null
  }

  function onDocumentClick(event: MouseEvent): void {
    const target = event.target
    if (target instanceof Element && target.closest('.kpo-ai-menu, .kpo-ai-manual')) return
    hideMenu()
  }

  function rememberFocusReturnElement(): void {
    const active = document.activeElement
    if (active instanceof HTMLElement && !active.closest('.kpo-ai-menu, .kpo-ai-manual')) {
      focusReturnElement = active
    }
  }

  onMounted(() => {
    document.addEventListener('click', onDocumentClick)
    window.addEventListener('scroll', hideMenu, true)
    window.addEventListener('resize', hideMenu)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocumentClick)
    window.removeEventListener('scroll', hideMenu, true)
    window.removeEventListener('resize', hideMenu)
  })

  return { menu, showMenu, hideMenu, restoreFocus }
}
