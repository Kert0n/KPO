import { describe, expect, it } from 'vitest'
import { waitForPlaygroundSettlement } from '../playgroundLifecycle'

describe('playground lifecycle', () => {
  it('releases a scoped waiter when its own transaction is cancelled', async () => {
    const controller = new AbortController()
    const settlement = new Promise<'ready'>(() => undefined)
    const waiting = waitForPlaygroundSettlement(settlement, controller.signal)

    controller.abort('new code switcher action')

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('does not need an unrelated Playground to settle', async () => {
    const controller = new AbortController()
    await expect(
      waitForPlaygroundSettlement(Promise.resolve<'ready'>('ready'), controller.signal)
    ).resolves.toBe('ready')
  })

  it('keeps cancellation authoritative after settlement', async () => {
    const controller = new AbortController()
    controller.abort('route change')

    await expect(
      waitForPlaygroundSettlement(Promise.resolve<'ready'>('ready'), controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
  })
})
