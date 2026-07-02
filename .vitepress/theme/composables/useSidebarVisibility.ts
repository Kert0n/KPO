import { ref, type Ref } from 'vue'

/**
 * Видимость сайдбара на десктопе.
 *
 * Состояние живёт только в памяти сессии: переживает SPA-переходы,
 * но любая загрузка страницы начинается с видимым сайдбаром
 * (решение пользователя — «по дефолту страница открывается с сайдбаром»).
 * Поэтому ни localStorage, ни head-скрипта здесь нет.
 *
 * Класс kpo-sidebar-hidden на <html> управляет вёрсткой (layout.css).
 */

const sidebarHidden = ref(false)

export function useSidebarVisibility(): {
  sidebarHidden: Ref<boolean>
  setSidebarHidden: (value: boolean) => void
} {
  return { sidebarHidden, setSidebarHidden }
}

function setSidebarHidden(value: boolean): void {
  sidebarHidden.value = value
  document.documentElement.classList.toggle('kpo-sidebar-hidden', value)
}
