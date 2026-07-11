import type { Router } from 'vitepress'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAdaptiveTables, type AdaptiveTablesController } from '../adaptiveTables'

let controller: AdaptiveTablesController | undefined
let animationFrames: Map<number, FrameRequestCallback>
let nextFrame: number
let observers: FakeResizeObserver[]
let blocks: FakeBlock[]

class FakeResizeObserver {
  disconnected = false
  observed: Element[] = []

  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }

  observe(target: Element): void {
    this.observed.push(target)
  }

  disconnect(): void {
    this.disconnected = true
  }

  unobserve(): void {}
}

type FakeBlock = {
  isConnected: boolean
  querySelector(): HTMLTableElement
}

beforeEach(() => {
  animationFrames = new Map()
  nextFrame = 1
  observers = []
  blocks = []

  vi.stubGlobal('window', {
    requestAnimationFrame(callback: FrameRequestCallback) {
      const frame = nextFrame++
      animationFrames.set(frame, callback)
      return frame
    },
    cancelAnimationFrame(frame: number) {
      animationFrames.delete(frame)
    }
  })
  vi.stubGlobal('document', {
    querySelectorAll: () => blocks
  })
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  controller?.dispose()
  controller = undefined
  vi.unstubAllGlobals()
})

describe('adaptive tables lifecycle', () => {
  it('disconnects observers and cancels RAF for detached table blocks', () => {
    const block: FakeBlock = {
      isConnected: true,
      querySelector: () => ({}) as HTMLTableElement
    }
    blocks.push(block)
    controller = installAdaptiveTables()

    flushAnimationFrames()
    expect(observers).toHaveLength(1)
    expect(animationFrames.size).toBe(1)

    block.isConnected = false
    controller?.disposeDisconnected()

    expect(observers[0].disconnected).toBe(true)
    expect(animationFrames.size).toBe(0)
  })

  it('preserves and restores the previous route hook', async () => {
    const previous = vi.fn(async () => {})
    const router = { onAfterRouteChanged: previous } as unknown as Router
    controller = installAdaptiveTables(router)
    const installedHook = router.onAfterRouteChanged

    expect(installedHook).not.toBe(previous)
    await installedHook?.('/intro')
    expect(previous).toHaveBeenCalledWith('/intro')

    controller?.dispose()
    expect(router.onAfterRouteChanged).toBe(previous)
  })

  it('disposes an earlier installation before replacing it', () => {
    blocks.push({
      isConnected: true,
      querySelector: () => ({}) as HTMLTableElement
    })
    const first = installAdaptiveTables()
    flushAnimationFrames()
    expect(observers[0].disconnected).toBe(false)

    const second = installAdaptiveTables()
    controller = second

    expect(observers[0].disconnected).toBe(true)
    first?.scan()
    expect(animationFrames.size).toBe(1)
  })
})

function flushAnimationFrames(): void {
  const pending = [...animationFrames.entries()]
  animationFrames.clear()
  for (const [, callback] of pending) callback(performance.now())
}
