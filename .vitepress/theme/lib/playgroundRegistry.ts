type KotlinPlaygroundInstance = {
  getCode: () => string
  codemirror?: {
    getSelection?: () => string
  }
}

type PlaygroundEntry = {
  code: string
  instance?: KotlinPlaygroundInstance
}

const playgrounds = new Map<string, PlaygroundEntry>()

export function registerPlayground(
  id: string,
  initialCode: string,
  instance?: KotlinPlaygroundInstance
): void {
  if (!id) return
  playgrounds.set(id, { code: instance?.getCode() ?? initialCode, instance })
}

export function updatePlaygroundCode(id: string, code: string): void {
  if (!id) return
  const entry = playgrounds.get(id)
  playgrounds.set(id, { ...entry, code })
}

export function unregisterPlayground(id: string): void {
  if (!id) return
  playgrounds.delete(id)
}

export function readPlaygroundCode(id: string): string {
  const entry = playgrounds.get(id)
  if (!entry) return ''

  try {
    return entry.instance?.getCode() ?? entry.code
  } catch {
    return entry.code
  }
}

export function readPlaygroundSelection(id: string): string {
  const entry = playgrounds.get(id)
  if (!entry) return ''

  try {
    return entry.instance?.codemirror?.getSelection?.().trim() ?? ''
  } catch {
    return ''
  }
}
