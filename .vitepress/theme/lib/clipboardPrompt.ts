export type CopyPromptMethod = 'clipboard-api' | 'textarea-exec-command'

export type CopyPromptAttempt = {
  method: CopyPromptMethod
  ok: boolean
  errorName?: string
}

export type CopyPromptResult = {
  ok: boolean
  attempts: CopyPromptAttempt[]
}

export async function copyPromptToClipboard(prompt: string): Promise<CopyPromptResult> {
  const attempts: CopyPromptAttempt[] = []

  const clipboard = globalThis.navigator?.clipboard
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(prompt)
      attempts.push({ method: 'clipboard-api', ok: true })
      return { ok: true, attempts }
    } catch (error) {
      attempts.push({
        method: 'clipboard-api',
        ok: false,
        errorName: errorName(error)
      })
    }
  }

  const textareaAttempt = copyWithTextarea(prompt)
  attempts.push(textareaAttempt)
  return {
    ok: textareaAttempt.ok,
    attempts
  }
}

function copyWithTextarea(prompt: string): CopyPromptAttempt {
  if (!globalThis.document?.createElement || !globalThis.document?.body) {
    return {
      method: 'textarea-exec-command',
      ok: false,
      errorName: 'DocumentUnavailable'
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = prompt
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return {
      method: 'textarea-exec-command',
      ok: document.execCommand('copy')
    }
  } catch (error) {
    return {
      method: 'textarea-exec-command',
      ok: false,
      errorName: errorName(error)
    }
  } finally {
    textarea.remove()
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError'
}
