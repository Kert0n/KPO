import { clamp } from '../../lib/math'

export type ViewportAnchor = {
  root: HTMLElement
  relativeViewportTop: number
}

export type ResolveAnchoredScrollTopInput = {
  relativeViewportTop: number
  newRootTop: number
  maxScrollY: number
}

export function captureViewportAnchor(root: HTMLElement): ViewportAnchor {
  const rootTop = root.getBoundingClientRect().top + window.scrollY

  return {
    root,
    relativeViewportTop: window.scrollY - rootTop
  }
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
  options: { frames?: number } = {}
): Promise<void> {
  if (!root || typeof window === 'undefined') {
    await mutate()
    return
  }

  const anchor = captureViewportAnchor(root)
  await mutate()
  await waitAnimationFrames(options.frames ?? 2)
  restoreViewportAnchor(anchor)
}

export function resolveAnchoredScrollTop(input: ResolveAnchoredScrollTopInput): number {
  return clamp(input.newRootTop + input.relativeViewportTop, 0, Math.max(0, input.maxScrollY))
}

export function waitAnimationFrames(frames: number): Promise<void> {
  const count = Math.max(0, Math.floor(frames))
  if (count === 0 || typeof window === 'undefined') return Promise.resolve()

  return new Promise((resolve) => {
    let remaining = count
    const step = () => {
      remaining -= 1
      if (remaining <= 0) {
        resolve()
        return
      }
      window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  })
}

function maxScrollY(): number {
  const documentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0
  )
  return Math.max(0, documentHeight - window.innerHeight)
}
