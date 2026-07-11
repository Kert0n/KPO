import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAskAiActionPreparation } from '../useAskAiActionPreparation'
import { useAskAiContextLoader } from '../useAskAiContextLoader'
import type { AskAiPageContext } from '../../lib/askAiModel'

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
      playgroundBlockId: ''
    })
    const second = preparation.prepare({
      selectedText: 'second',
      blockIds: ['block'],
      playgroundBlockId: ''
    })

    resolvers[1](context('second'))
    await second
    resolvers[0](context('first'))
    await first

    expect(preparation.preparedAction.value?.snapshot.selectedText).toBe('second')
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
