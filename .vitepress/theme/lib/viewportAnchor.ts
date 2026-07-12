import { clamp } from '../../shared/core/math'

export type ViewportAnchor = {
  root: HTMLElement
  relativeViewportTop: number
}

export type ResolveAnchoredScrollTopInput = {
  relativeViewportTop: number
  newRootTop: number
  maxScrollY: number
}

export type AnchorLayoutMeasurement = {
  rootTop: number
  rootHeight: number
  documentHeight: number
}

export type PreserveViewportAnchorOptions = {
  frames?: number
  stableFrames?: number
  epsilon?: number
  settle?: () => Promise<unknown>
  emergencyTimeoutMs?: number
  initiatingKeyEvent?: KeyboardEvent
}

export function captureViewportAnchor(root: HTMLElement): ViewportAnchor {
  const rootTop = root.getBoundingClientRect().top + window.scrollY
  return { root, relativeViewportTop: window.scrollY - rootTop }
}

export function restoreViewportAnchor(anchor: ViewportAnchor): void {
  const newRootTop = anchor.root.getBoundingClientRect().top + window.scrollY
  const target = resolveAnchoredScrollTop({
    relativeViewportTop: anchor.relativeViewportTop,
    newRootTop,
    maxScrollY: maxScrollY()
  })
  window.scrollTo({ top: target, behavior: 'auto' })
}

export async function preserveViewportAnchor(
  root: HTMLElement | null | undefined,
  mutate: () => void | Promise<void>,
  options: PreserveViewportAnchorOptions = {}
): Promise<void> {
  if (!root || typeof window === 'undefined') {
    await mutate()
    return
  }

  const anchor = captureViewportAnchor(root)
  let interrupted = false
  let restoreFrame: number | null = null
  const restoreIfOwned = () => {
    if (!interrupted && anchor.root.isConnected) restoreViewportAnchor(anchor)
  }
  const queueRestore = () => {
    if (restoreFrame !== null || interrupted) return
    restoreFrame = window.requestAnimationFrame(() => {
      restoreFrame = null
      restoreIfOwned()
    })
  }
  const observer = createAnchorObserver(anchor.root, queueRestore)

  await mutate()

  // The initiating click/keydown must finish propagating before Home/End or
  // pointer events become interruption signals for this transaction.
  await Promise.resolve()
  const interruption = createViewportAnchorInterruption(() => {
    interrupted = true
    if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
    restoreFrame = null
  }, options.initiatingKeyEvent)

  try {
    await waitAnimationFrames(options.frames ?? 2)
    restoreIfOwned()

    if (options.settle && !interrupted && anchor.root.isConnected) {
      await settleWithEmergencyLimit(options.settle(), options.emergencyTimeoutMs ?? 10_000)
    }

    if (!interrupted && anchor.root.isConnected) {
      await waitForStableAnchorLayout(anchor, options, () => interrupted)
      restoreIfOwned()
    }
  } finally {
    observer?.disconnect()
    interruption.dispose()
    if (restoreFrame !== null) window.cancelAnimationFrame(restoreFrame)
  }
}

export function resolveAnchoredScrollTop(input: ResolveAnchoredScrollTopInput): number {
  return clamp(input.newRootTop + input.relativeViewportTop, 0, Math.max(0, input.maxScrollY))
}

export function measureAnchorLayout(root: HTMLElement): AnchorLayoutMeasurement {
  const rect = root.getBoundingClientRect()
  return {
    rootTop: rect.top + window.scrollY,
    rootHeight: rect.height,
    documentHeight: documentHeight()
  }
}

export function isAnchorLayoutStable(
  previous: AnchorLayoutMeasurement,
  current: AnchorLayoutMeasurement,
  epsilon = 1
): boolean {
  return (
    Math.abs(previous.rootTop - current.rootTop) <= epsilon &&
    Math.abs(previous.rootHeight - current.rootHeight) <= epsilon &&
    Math.abs(previous.documentHeight - current.documentHeight) <= epsilon
  )
}

export function isScrollIntentKey(key: string): boolean {
  return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(key)
}

export function waitAnimationFrames(frames: number): Promise<void> {
  const count = Math.max(0, Math.floor(frames))
  if (count === 0 || typeof window === 'undefined') return Promise.resolve()

  return new Promise((resolve) => {
    let remaining = count
    const step = () => {
      remaining -= 1
      if (remaining <= 0) resolve()
      else window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  })
}

async function waitForStableAnchorLayout(
  anchor: ViewportAnchor,
  options: PreserveViewportAnchorOptions,
  interrupted: () => boolean
): Promise<void> {
  const stableFrames = Math.max(1, Math.floor(options.stableFrames ?? 4))
  const epsilon = options.epsilon ?? 1
  const emergencyTimeoutMs = options.emergencyTimeoutMs ?? 10_000
  const startedAt = performance.now()
  let stableCount = 0
  let previous = measureAnchorLayout(anchor.root)

  while (
    anchor.root.isConnected &&
    !interrupted() &&
    performance.now() - startedAt < emergencyTimeoutMs
  ) {
    await waitAnimationFrames(1)
    if (interrupted() || !anchor.root.isConnected) return

    const current = measureAnchorLayout(anchor.root)
    restoreViewportAnchor(anchor)
    stableCount = isAnchorLayoutStable(previous, current, epsilon) ? stableCount + 1 : 0
    if (stableCount >= stableFrames) return
    previous = current
  }
}

function createAnchorObserver(root: HTMLElement, onResize: () => void): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') return null
  const observer = new ResizeObserver(onResize)
  observer.observe(root)
  observer.observe(document.documentElement)
  return observer
}

function createViewportAnchorInterruption(
  onInterrupt: () => void,
  initiatingKeyEvent?: KeyboardEvent
): { dispose: () => void } {
  const onKeydown = (event: KeyboardEvent) => {
    if (event === initiatingKeyEvent) return
    if (isScrollIntentKey(event.key)) onInterrupt()
  }
  window.addEventListener('wheel', onInterrupt, { passive: true })
  window.addEventListener('touchstart', onInterrupt, { passive: true })
  window.addEventListener('pointerdown', onInterrupt, { passive: true })
  window.addEventListener('keydown', onKeydown)

  return {
    dispose: () => {
      window.removeEventListener('wheel', onInterrupt)
      window.removeEventListener('touchstart', onInterrupt)
      window.removeEventListener('pointerdown', onInterrupt)
      window.removeEventListener('keydown', onKeydown)
    }
  }
}

async function settleWithEmergencyLimit(
  settle: Promise<unknown>,
  timeoutMs: number
): Promise<void> {
  let timeout: number | null = null
  try {
    await Promise.race([
      settle,
      new Promise<void>((resolve) => {
        timeout = window.setTimeout(resolve, Math.max(0, timeoutMs))
      })
    ])
  } finally {
    if (timeout !== null) window.clearTimeout(timeout)
  }
}

function maxScrollY(): number {
  return Math.max(0, documentHeight() - window.innerHeight)
}

function documentHeight(): number {
  return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)
}
