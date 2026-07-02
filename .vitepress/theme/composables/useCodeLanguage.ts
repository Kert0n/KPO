import type { Ref } from 'vue'
import { createPersistentState } from './persistentState'

/**
 * Глобально выбранный язык примеров кода.
 * Переключение в одном CodeSwitcher мгновенно меняет все остальные.
 *
 * Язык дублируется в html[data-kpo-lang]: по этому атрибуту чистым CSS
 * показываются секции ::: only и вставки <LangOnly> (начальное значение
 * ставит скрипт в <head>, см. config.mts).
 */

const language = createPersistentState<string>({
  key: 'kpo:code-language',
  initial: 'kotlin',
  encode: (value) => value,
  decode: (raw) => raw,
  onChange: (value) => {
    document.documentElement.dataset.kpoLang = value
  }
})

export function useCodeLanguage(): {
  activeLanguage: Ref<string>
  setActiveLanguage: (value: string) => void
} {
  language.setupOnMounted()

  return {
    activeLanguage: language.state,
    setActiveLanguage: language.set
  }
}
