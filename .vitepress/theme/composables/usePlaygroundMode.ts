import type { Ref } from 'vue'
import { booleanCodec, createPersistentState } from './persistentState'

/**
 * Глобальный режим Kotlin Playground.
 * Кнопка-переключатель стоит на каждом блоке кода, но состояние одно
 * на весь сайт: выключил на одном примере — выключилось везде.
 */

const mode = createPersistentState<boolean>({
  key: 'kpo:playground-mode',
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
