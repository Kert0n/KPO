import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMermaidRenderer } from '../useMermaidRenderer'

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn()
}))

vi.mock('mermaid', () => ({ default: mermaid }))

const tokens = {
  fontFamily: 'Inter',
  background: '#fff',
  softBackground: '#eee',
  text: '#111',
  mutedText: '#555',
  border: '#999'
}

beforeEach(() => {
  mermaid.initialize.mockReset()
  mermaid.render.mockReset()
})

describe('useMermaidRenderer', () => {
  it('serializes singleton renders and only publishes the latest generation', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const renderer = createRenderer()

    const first = renderer.render()
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const second = renderer.render()
    expect(pending).toHaveLength(1)

    pending[0]({ svg: svg(50, 25) })
    await expect(first).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(200, 100) })
    await expect(second).resolves.toBe('rendered')

    expect(renderer.svg.value).toBe(svg(200, 100))
    expect(renderer.viewBoxWidth.value).toBe(200)
  })

  it('drops a stale queued generation before initialize and render', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const firstRenderer = createRenderer('first')
    const secondRenderer = createRenderer('second')

    const first = firstRenderer.render()
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const stale = secondRenderer.render()
    const latest = secondRenderer.render()

    pending[0]({ svg: svg(50, 25) })
    await expect(first).resolves.toBe('rendered')
    await expect(stale).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(200, 100) })
    await expect(latest).resolves.toBe('rendered')

    expect(mermaid.initialize).toHaveBeenCalledTimes(2)
    expect(mermaid.render).toHaveBeenCalledTimes(2)
  })

  it('does not publish a render after disposal', async () => {
    let resolveRender: (value: { svg: string }) => void = () => undefined
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => (resolveRender = resolve))
    )
    const renderer = createRenderer()
    const pending = renderer.render()
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce())

    renderer.dispose()
    resolveRender({ svg: svg(100, 50) })

    await expect(pending).resolves.toBe('stale')
    expect(renderer.svg.value).toBe('')
  })
})

function createRenderer(instanceId = 'diagram') {
  return useMermaidRenderer({
    code: ref('flowchart LR\nA --> B'),
    instanceId,
    themeTokens: () => tokens
  })
}

function svg(width: number, height: number): string {
  return `<svg viewBox="0 0 ${width} ${height}"></svg>`
}
