import type { Ref } from 'vue'
import { booleanCodec, createPersistentState } from './persistentState'
import { STORAGE_KEYS } from '../../shared/site'

/**
 * Глобальный режим Kotlin Playground.
 * Кнопка-переключатель стоит на каждом блоке кода, но состояние одно
 * на весь сайт: выключил на одном примере — выключилось везде.
 */

const mode = createPersistentState<boolean>({
  key: STORAGE_KEYS.playgroundMode,
  initial: true,
  validate: (value) => typeof value === 'boolean',
  ...booleanCodec
})

export function usePlaygroundMode(): {
  playgroundMode: Ref<boolean>
  setPlaygroundMode: (value: boolean) => void
} {
  mode.setupOnMounted()

  return {
    playgroundMode: mode.state,
    setPlaygroundMode: mode.set
  }
}
