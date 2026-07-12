export type PlaygroundInitialization = {
  settle(): void
}

const pending = new Set<Promise<void>>()

export function beginPlaygroundInitialization(): PlaygroundInitialization {
  let settled = false
  let resolveInitialization: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    resolveInitialization = resolve
  })
  pending.add(promise)

  return {
    settle() {
      if (settled) return
      settled = true
      pending.delete(promise)
      resolveInitialization()
    }
  }
}

export async function waitForPlaygroundInitializations(): Promise<void> {
  while (pending.size > 0) {
    const current = [...pending]
    await Promise.allSettled(current)
    await Promise.resolve()
  }
}

export function pendingPlaygroundInitializations(): number {
  return pending.size
}
