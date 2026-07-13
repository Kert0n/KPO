import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAskAiActionPreparation } from '../useAskAiActionPreparation'
import { useAskAiContextLoader } from '../useAskAiContextLoader'
import type { AskAiPageContext } from '../../lib/askAiModel'
import { playgroundOverride } from '../../lib/askAiSelectionSnapshot'
import { registerPlayground, unregisterPlayground } from '../../lib/playgroundRegistry'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Ask AI lifecycle', () => {
  it('aborts an in-flight context request during route invalidation', async () => {
    let requestSignal: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? undefined
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })
    )
    const loader = useAskAiContextLoader({
      routePath: () => '/lectures/01',
      base: () => '/KPO/',
      withBase: (path) => `/KPO/${path.replace(/^\//, '')}`
    })

    const pending = loader.loadPageContext()
    loader.invalidateRoute()

    expect(requestSignal?.aborted).toBe(true)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(loader.loading.value).toBe(false)
  })

  it('keeps only the latest prepared action generation', async () => {
    const resolvers: Array<(context: AskAiPageContext) => void> = []
    const loadPageContext = () =>
      new Promise<AskAiPageContext>((resolve) => resolvers.push(resolve))
    const provider = ref<'clipboard'>('clipboard')
    const preparation = useAskAiActionPreparation({
      provider,
      loadPageContext,
      fallbackContext: (selectedText) => context(selectedText)
    })
    const first = preparation.prepare({
      selectedText: 'first',
      blockIds: ['block'],
      currentBlockId: 'block'
    })
    const second = preparation.prepare({
      selectedText: 'second',
      blockIds: ['block'],
      currentBlockId: 'block'
    })

    resolvers[1](context('second'))
    await second
    resolvers[0](context('first'))
    await first

    expect(preparation.preparedAction.value?.snapshot.selectedText).toBe('second')
  })

  it('uses the current block captured before the asynchronous context load', async () => {
    let resolveContext!: (value: AskAiPageContext) => void
    const provider = ref<'clipboard'>('clipboard')
    const preparation = useAskAiActionPreparation({
      provider,
      loadPageContext: () =>
        new Promise<AskAiPageContext>((resolve) => {
          resolveContext = resolve
        }),
      fallbackContext: (selectedText) => context(selectedText)
    })
    const snapshot = {
      selectedText: 'val frozen = true',
      blockIds: ['block'],
      currentBlockId: 'block',
      activeLanguage: 'kotlin',
      currentOverride: {
        kind: 'code' as const,
        language: 'kotlin',
        markdown: '```kotlin\nval frozen = true\n```'
      }
    }

    const pending = preparation.prepare(snapshot)
    snapshot.currentOverride.markdown = '```java\nvar changed = true;\n```'
    resolveContext(context('source context'))
    await pending

    expect(preparation.preparedAction.value?.action.prompt).toContain('val frozen = true')
    expect(preparation.preparedAction.value?.action.prompt).not.toContain('var changed = true')
  })

  it('freezes Playground code when the selection snapshot is created', () => {
    expect(playgroundOverride('')).toBeUndefined()
    registerPlayground('empty-playground', '')
    expect(playgroundOverride('empty-playground')).toBeUndefined()
    unregisterPlayground('empty-playground')

    let code = 'fun main() = println("before")'
    registerPlayground('playground-block', code, { getCode: () => code })

    const snapshotOverride = playgroundOverride('playground-block')
    code = 'fun main() = println("after")'

    expect(snapshotOverride?.markdown).toContain('println("before")')
    expect(snapshotOverride?.markdown).not.toContain('println("after")')
    unregisterPlayground('playground-block')
  })
})

function context(markdown: string): AskAiPageContext {
  return {
    courseTitle: 'Course',
    courseDescription: 'Description',
    pageTitle: 'Page',
    pageDescription: 'Page description',
    sourcePath: 'content/page.md',
    blocks: [
      {
        id: 'block',
        kind: 'paragraph',
        markdown,
        plainText: markdown,
        lineStart: 1,
        lineEnd: 1
      }
    ]
  }
}
