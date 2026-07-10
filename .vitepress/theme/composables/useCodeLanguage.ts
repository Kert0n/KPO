import type { Ref } from 'vue'
import { isSupportedCodeLanguage, type CodeLanguage } from '../lib/codeBlockModel'
import { createPersistentState } from './persistentState'
import { STORAGE_KEYS } from '../../shared/site'

/**
 * Глобально выбранный язык примеров кода.
 * Переключение в одном CodeSwitcher мгновенно меняет все остальные.
 *
 * Язык дублируется в html[data-kpo-lang]: по этому атрибуту чистым CSS
 * показываются секции ::: only и вставки <LangOnly> (начальное значение
 * ставит скрипт в <head>, см. config.mts).
 *
 * Авторские default-ы конкретных code-блоков здесь не живут. Их
 * приоритет считается в CodeSwitcher через codeBlockModel.
 */

const language = createPersistentState<CodeLanguage>({
  key: STORAGE_KEYS.codeLanguage,
  initial: 'kotlin',
  encode: (value) => value,
  decode: (raw) => raw as CodeLanguage,
  validate: isSupportedCodeLanguage,
  onChange: (value) => {
    document.documentElement.dataset.kpoLang = value
  }
})

export function useCodeLanguage(): {
  activeLanguage: Ref<CodeLanguage>
  setActiveLanguage: (value: CodeLanguage) => void
} {
  language.setupOnMounted()

  return {
    activeLanguage: language.state,
    setActiveLanguage: language.set
  }
}
