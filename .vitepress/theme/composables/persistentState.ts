import { onMounted, ref, type Ref } from 'vue'

/**
 * Общий каркас для глобальных persist-состояний сайта
 * (язык примеров, режим playground, видимость сайдбара).
 *
 * Свойства:
 *  - один ref на модуль: все компоненты видят одно состояние;
 *  - localStorage + событие storage: синхронизация между вкладками;
 *  - инициализация в onMounted: SSR-разметка всегда совпадает
 *    с первой клиентской отрисовкой, никаких ошибок гидрации —
 *    сохранённое значение применяется сразу после монтирования
 *    (а мгновенное применение до отрисовки делают head-скрипты
 *    в config.mts, где это критично для вёрстки).
 */

type PersistentStateOptions<T> = {
  key: string
  initial: T
  encode: (value: T) => string
  decode: (raw: string) => T
  /** Побочный эффект на каждое изменение (например, атрибут на <html>) */
  onChange?: (value: T) => void
}

type PersistentState<T> = {
  state: Ref<T>
  set: (value: T) => void
  /** Вызывать в composable: регистрирует инициализацию после монтирования */
  setupOnMounted: () => void
}

export function createPersistentState<T>(options: PersistentStateOptions<T>): PersistentState<T> {
  const state = ref(options.initial) as Ref<T>
  let initialized = false

  function apply(value: T): void {
    state.value = value
    options.onChange?.(value)
  }

  function set(value: T): void {
    apply(value)
    window.localStorage.setItem(options.key, options.encode(value))
  }

  function initialize(): void {
    if (initialized) return
    initialized = true

    const raw = window.localStorage.getItem(options.key)
    if (raw !== null) apply(options.decode(raw))
    else options.onChange?.(state.value)

    window.addEventListener('storage', (event) => {
      if (event.key === options.key && event.newValue !== null) {
        apply(options.decode(event.newValue))
      }
    })
  }

  return {
    state,
    set,
    setupOnMounted: () => onMounted(initialize)
  }
}

export const booleanCodec = {
  encode: (value: boolean): string => (value ? '1' : '0'),
  decode: (raw: string): boolean => raw !== '0'
}
