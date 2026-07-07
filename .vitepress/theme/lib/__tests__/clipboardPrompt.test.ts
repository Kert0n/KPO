import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyPromptToClipboard } from '../clipboardPrompt'

describe('clipboardPrompt', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('uses Clipboard API first', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: { writeText }
    })

    const result = await copyPromptToClipboard('prompt')

    expect(writeText).toHaveBeenCalledWith('prompt')
    expect(result).toEqual({
      ok: true,
      attempts: [
        { method: 'clipboard-api', ok: true }
      ]
    })
  })

  it('falls back to textarea after Clipboard API failure', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const documentMock = createDocumentMock(true)
    vi.stubGlobal('navigator', {
      clipboard: { writeText }
    })
    vi.stubGlobal('document', documentMock)

    const result = await copyPromptToClipboard('fallback prompt')

    expect(writeText).toHaveBeenCalledWith('fallback prompt')
    expect(documentMock.execCommand).toHaveBeenCalledWith('copy')
    expect(documentMock.textarea.value).toBe('fallback prompt')
    expect(result).toEqual({
      ok: true,
      attempts: [
        { method: 'clipboard-api', ok: false, errorName: 'NotAllowedError' },
        { method: 'textarea-exec-command', ok: true }
      ]
    })
  })

  it('reports failure after both methods fail', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new DOMException('blocked', 'NotAllowedError'))
    const documentMock = createDocumentMock(false)
    vi.stubGlobal('navigator', {
      clipboard: { writeText }
    })
    vi.stubGlobal('document', documentMock)

    const result = await copyPromptToClipboard('uncopied prompt')

    expect(documentMock.execCommand).toHaveBeenCalledWith('copy')
    expect(result).toEqual({
      ok: false,
      attempts: [
        { method: 'clipboard-api', ok: false, errorName: 'NotAllowedError' },
        { method: 'textarea-exec-command', ok: false }
      ]
    })
  })
})

function createDocumentMock(execCommandResult: boolean): {
  body: { appendChild: ReturnType<typeof vi.fn> }
  createElement: ReturnType<typeof vi.fn>
  execCommand: ReturnType<typeof vi.fn>
  textarea: HTMLTextAreaElement
} {
  const textarea = {
    value: '',
    style: {},
    setAttribute: vi.fn(),
    focus: vi.fn(),
    select: vi.fn(),
    remove: vi.fn()
  } as unknown as HTMLTextAreaElement

  return {
    body: {
      appendChild: vi.fn()
    },
    createElement: vi.fn(() => textarea),
    execCommand: vi.fn(() => execCommandResult),
    textarea
  }
}
