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
  validate?: (value: T) => boolean
  /** Побочный эффект на каждое изменение (например, атрибут на <html>) */
  onChange?: (value: T) => void
}

type PersistentState<T> = {
  state: Ref<T>
  set: (value: T) => void
  initialize: () => void
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
    if (!isValid(value)) return

    apply(value)
    try {
      window.localStorage.setItem(options.key, options.encode(value))
    } catch (error) {
      console.warn(`[persistentState] не удалось сохранить "${options.key}":`, error)
    }
  }

  function initialize(): void {
    if (initialized) return
    initialized = true

    apply(readStoredValue())

    window.addEventListener('storage', (event) => {
      if (event.key === options.key) apply(readStorageEventValue(event.newValue))
    })
  }

  return {
    state,
    set,
    initialize,
    setupOnMounted: () => onMounted(initialize)
  }

  function readStoredValue(): T {
    try {
      const raw = window.localStorage.getItem(options.key)
      if (raw === null) return options.initial

      return decodeStoredValue(raw)
    } catch (error) {
      console.warn(`[persistentState] не удалось прочитать "${options.key}":`, error)
      return options.initial
    }
  }

  function readStorageEventValue(raw: string | null): T {
    if (raw === null) return options.initial
    return decodeStoredValue(raw)
  }

  function decodeStoredValue(raw: string): T {
    try {
      const value = options.decode(raw)
      if (isValid(value)) return value
    } catch (error) {
      console.warn(`[persistentState] некорректное значение "${options.key}":`, error)
    }

    removeInvalidStoredValue()
    return options.initial
  }

  function isValid(value: T): boolean {
    return options.validate?.(value) ?? true
  }

  function removeInvalidStoredValue(): void {
    try {
      window.localStorage.removeItem(options.key)
    } catch {
      // Ignore storage cleanup failures: the in-memory state is already reset.
    }
  }
}

export const booleanCodec = {
  encode: (value: boolean): string => (value ? '1' : '0'),
  decode: (raw: string): boolean => raw !== '0'
}
