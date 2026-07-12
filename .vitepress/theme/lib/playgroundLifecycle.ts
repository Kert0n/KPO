import type { Ref } from 'vue'

export type PlaygroundState = 'initializing' | 'ready' | 'error' | 'disposed'
export type PlaygroundSettlement = Exclude<PlaygroundState, 'initializing'>

export type PlaygroundLifecycle = {
  state: Readonly<Ref<PlaygroundState>>
  whenSettled(signal: AbortSignal): Promise<PlaygroundSettlement>
  measure(): { width: number; height: number }
}

export function waitForPlaygroundSettlement<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal))

  return new Promise((resolve, reject) => {
    const abort = () => {
      cleanup()
      reject(abortError(signal))
    }
    const cleanup = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    promise.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error: unknown) => {
        cleanup()
        reject(error)
      }
    )
  })
}

function abortError(signal: AbortSignal): DOMException {
  return new DOMException(String(signal.reason ?? 'Playground lifecycle cancelled'), 'AbortError')
}
