import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MermaidThemeTokens } from '../../lib/mermaidThemeModel'
import { useMermaidRenderer } from '../useMermaidRenderer'

const mermaid = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn()
}))

vi.mock('mermaid', () => ({ default: mermaid }))

const lightTokens: MermaidThemeTokens = {
  darkMode: false,
  fontFamily: 'Inter',
  background: '#fff',
  softBackground: '#eee',
  text: '#111',
  mutedText: '#555',
  border: '#999'
}

const darkTokens: MermaidThemeTokens = {
  darkMode: true,
  fontFamily: 'Inter',
  background: '#111',
  softBackground: '#222',
  text: '#fafafa',
  mutedText: '#ccc',
  border: '#777'
}

beforeEach(() => {
  mermaid.initialize.mockReset()
  mermaid.render.mockReset()
  mermaid.render.mockResolvedValue({ svg: svg(100, 50) })
})

describe('useMermaidRenderer', () => {
  it('publishes a light render from the explicit light request snapshot', async () => {
    const renderer = createRenderer()

    await expect(renderer.render(request(lightTokens))).resolves.toBe('rendered')

    expect(renderer.svg.value).toBe(svg(100, 50))
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          darkMode: false,
          background: lightTokens.background,
          edgeLabelBackground: lightTokens.background,
          primaryTextColor: lightTokens.text,
          primaryColor: lightTokens.softBackground,
          primaryBorderColor: lightTokens.border
        })
      })
    )
  })

  it('serializes singleton renders and only publishes the latest generation', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const renderer = createRenderer()

    const first = renderer.render(request(lightTokens))
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const second = renderer.render(request(darkTokens))
    expect(pending).toHaveLength(1)

    pending[0]({ svg: svg(50, 25) })
    await expect(first).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(200, 100) })
    await expect(second).resolves.toBe('rendered')

    expect(renderer.svg.value).toBe(svg(200, 100))
    expect(renderer.viewBoxWidth.value).toBe(200)
  })

  it('marks an active light render stale after a newer dark request', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const renderer = createRenderer()

    const first = renderer.render(request(lightTokens))
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const second = renderer.render(request(darkTokens))

    pending[0]({ svg: svg(50, 25) })
    await expect(first).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(200, 100) })
    await expect(second).resolves.toBe('rendered')

    expect(renderer.svg.value).toBe(svg(200, 100))
    expect(mermaid.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({
          darkMode: true,
          background: darkTokens.background,
          primaryTextColor: darkTokens.text
        })
      })
    )
  })

  it('drops a stale queued generation before initialize and render', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const firstRenderer = createRenderer('first')
    const secondRenderer = createRenderer('second')

    const first = firstRenderer.render(request(lightTokens, 'flowchart LR\nA --> B'))
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const stale = secondRenderer.render(request(darkTokens, 'flowchart LR\nB --> C'))
    const latest = secondRenderer.render(request(lightTokens, 'flowchart LR\nC --> D'))

    pending[0]({ svg: svg(50, 25) })
    await expect(first).resolves.toBe('rendered')
    await expect(stale).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(200, 100) })
    await expect(latest).resolves.toBe('rendered')

    expect(mermaid.initialize).toHaveBeenCalledTimes(2)
    expect(mermaid.render).toHaveBeenCalledTimes(2)
    expect(mermaid.initialize).not.toHaveBeenCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({ background: darkTokens.background })
      })
    )
  })

  it('uses request snapshots in light to dark to light order', async () => {
    const renderer = createRenderer()

    await expect(renderer.render(request(lightTokens))).resolves.toBe('rendered')
    await expect(renderer.render(request(darkTokens))).resolves.toBe('rendered')
    await expect(renderer.render(request(lightTokens))).resolves.toBe('rendered')

    const backgrounds = mermaid.initialize.mock.calls.map(
      ([config]) => config.themeVariables.background
    )
    expect(backgrounds).toEqual([
      lightTokens.background,
      darkTokens.background,
      lightTokens.background
    ])
  })

  it('publishes only the last generation during rapid light dark light requests', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const renderer = createRenderer()

    const first = renderer.render(request(lightTokens))
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const second = renderer.render(request(darkTokens))
    const third = renderer.render(request(lightTokens))

    pending[0]({ svg: svg(50, 25) })
    await expect(first).resolves.toBe('stale')
    await expect(second).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(300, 150) })
    await expect(third).resolves.toBe('rendered')

    expect(renderer.svg.value).toBe(svg(300, 150))
    expect(mermaid.initialize).toHaveBeenCalledTimes(2)
    expect(mermaid.initialize).toHaveBeenLastCalledWith(
      expect.objectContaining({
        themeVariables: expect.objectContaining({ background: lightTokens.background })
      })
    )
  })

  it('shares the singleton queue while publishing each diagram current generation only', async () => {
    const pending: Array<(value: { svg: string }) => void> = []
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => pending.push(resolve))
    )
    const firstRenderer = createRenderer('first')
    const secondRenderer = createRenderer('second')

    const firstOld = firstRenderer.render(request(lightTokens))
    await vi.waitFor(() => expect(pending).toHaveLength(1))
    const secondLatest = secondRenderer.render(request(darkTokens))
    const firstLatest = firstRenderer.render(request(darkTokens))

    pending[0]({ svg: svg(50, 25) })
    await expect(firstOld).resolves.toBe('stale')
    await vi.waitFor(() => expect(pending).toHaveLength(2))
    pending[1]({ svg: svg(200, 100) })
    await expect(secondLatest).resolves.toBe('rendered')
    await vi.waitFor(() => expect(pending).toHaveLength(3))
    pending[2]({ svg: svg(300, 150) })
    await expect(firstLatest).resolves.toBe('rendered')

    expect(firstRenderer.svg.value).toBe(svg(300, 150))
    expect(secondRenderer.svg.value).toBe(svg(200, 100))
  })

  it('does not publish a render after disposal', async () => {
    let resolveRender: (value: { svg: string }) => void = () => undefined
    mermaid.render.mockImplementation(
      () => new Promise<{ svg: string }>((resolve) => (resolveRender = resolve))
    )
    const renderer = createRenderer()
    const pending = renderer.render(request(lightTokens))
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce())

    renderer.dispose()
    resolveRender({ svg: svg(100, 50) })

    await expect(pending).resolves.toBe('stale')
    expect(renderer.svg.value).toBe('')
  })

  it('does not publish an error after disposal during a theme change', async () => {
    let rejectRender: (error: Error) => void = () => undefined
    mermaid.render.mockImplementation(
      () =>
        new Promise<{ svg: string }>((_, reject) => {
          rejectRender = reject
        })
    )
    const renderer = createRenderer()
    const pending = renderer.render(request(darkTokens))
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce())

    renderer.dispose()
    rejectRender(new Error('late failure'))

    await expect(pending).resolves.toBe('stale')
    expect(renderer.failed.value).toBe(false)
    expect(renderer.errorMessage.value).toBe('')
  })

  it('publishes an active render failure and recovers on the next request', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mermaid.render.mockRejectedValueOnce(new Error('fixture render failure'))
    const renderer = createRenderer()

    await expect(renderer.render(request(darkTokens))).resolves.toBe('failed')
    expect(renderer.failed.value).toBe(true)
    expect(renderer.errorMessage.value).toBe('fixture render failure')
    expect(renderer.svg.value).toBe('')

    mermaid.render.mockResolvedValueOnce({ svg: svg(120, 60) })
    await expect(renderer.render(request(lightTokens))).resolves.toBe('rendered')
    expect(renderer.failed.value).toBe(false)
    expect(renderer.svg.value).toBe(svg(120, 60))
    warning.mockRestore()
  })

  it('formats non-Error Mermaid failures without hiding them', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mermaid.render.mockRejectedValueOnce('fixture failure')
    const renderer = createRenderer()

    await expect(renderer.render(request(lightTokens))).resolves.toBe('failed')
    expect(renderer.errorMessage.value).toBe('fixture failure')
    warning.mockRestore()
  })
})

function createRenderer(instanceId = 'diagram') {
  return useMermaidRenderer({ instanceId })
}

function request(theme: MermaidThemeTokens, code = 'flowchart LR\nA --> B') {
  return { code, theme }
}

function svg(width: number, height: number): string {
  return `<svg viewBox="0 0 ${width} ${height}"></svg>`
}
