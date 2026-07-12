import { describe, expect, it } from 'vitest'
import {
  beginPlaygroundInitialization,
  pendingPlaygroundInitializations,
  waitForPlaygroundInitializations
} from '../playgroundLifecycle'

describe('playgroundLifecycle', () => {
  it('waits for every initialization active in the current lifecycle wave', async () => {
    const first = beginPlaygroundInitialization()
    const second = beginPlaygroundInitialization()
    let completed = false
    const waiting = waitForPlaygroundInitializations().then(() => {
      completed = true
    })

    first.settle()
    await Promise.resolve()
    expect(completed).toBe(false)
    expect(pendingPlaygroundInitializations()).toBe(1)

    second.settle()
    await waiting
    expect(completed).toBe(true)
    expect(pendingPlaygroundInitializations()).toBe(0)
  })
})
