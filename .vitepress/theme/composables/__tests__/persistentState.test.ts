import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPersistentState } from '../persistentState'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

type StorageListener = (event: { key: string; newValue: string | null }) => void

function installWindow(storage: MemoryStorage = new MemoryStorage()): {
  storage: MemoryStorage
  listeners: StorageListener[]
} {
  const listeners: StorageListener[] = []

  vi.stubGlobal('window', {
    localStorage: storage,
    addEventListener: (type: string, listener: StorageListener) => {
      if (type === 'storage') listeners.push(listener)
    }
  })

  return { storage, listeners }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createPersistentState', () => {
  it('resets invalid stored value', () => {
    const { storage } = installWindow()
    storage.setItem('state', 'bad')

    const state = createPersistentState({
      key: 'state',
      initial: 'ok',
      encode: (value) => value,
      decode: (raw) => raw,
      validate: (value) => value === 'ok'
    })

    state.initialize()

    expect(state.state.value).toBe('ok')
    expect(storage.getItem('state')).toBeNull()
  })

  it('resets when storage key is removed in another tab', () => {
    const { listeners } = installWindow()
    const state = createPersistentState({
      key: 'state',
      initial: 'initial',
      encode: (value) => value,
      decode: (raw) => raw
    })

    state.initialize()
    state.set('changed')
    listeners[0]({ key: 'state', newValue: null })

    expect(state.state.value).toBe('initial')
  })

  it('does not crash when writing to storage fails', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota')
        },
        removeItem: () => undefined
      },
      addEventListener: () => undefined
    })

    const state = createPersistentState({
      key: 'state',
      initial: 'initial',
      encode: (value) => value,
      decode: (raw) => raw
    })

    expect(() => state.set('changed')).not.toThrow()
    expect(state.state.value).toBe('changed')
  })
})
