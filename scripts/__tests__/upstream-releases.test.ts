import { describe, expect, it, vi } from 'vitest'
import type { Packument } from '../dependency-pins.mts'
import {
  commentBody,
  marker,
  notify,
  reached,
  statuses,
  WATCHES,
  type GitHub,
  type Milestone
} from '../upstream-releases.mts'

const packument = (...versions: string[]): Packument => ({
  'dist-tags': {},
  versions: Object.fromEntries(versions.map((version) => [version, {}]))
})

const vitepress = WATCHES.find((watch) => watch.package === 'vitepress')!
const milestone = (id: string): Milestone => {
  const found = vitepress.milestones.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`нет вехи ${id}`)
  return found
}
const beta = milestone('vitepress-2-beta')
const stable = milestone('vitepress-2-stable')

describe('upstream release watches', () => {
  it('waits while VitePress 2 is only in alpha', () => {
    const today = packument('1.6.4', '2.0.0-alpha.20', '2.0.0-alpha.21')
    expect(reached(today, beta)).toBeUndefined()
    expect(reached(today, stable)).toBeUndefined()
  })

  it('counts a beta, and an rc that skipped beta, as the beta milestone', () => {
    expect(reached(packument('2.0.0-alpha.21', '2.0.0-beta.0'), beta)).toBe('2.0.0-beta.0')
    expect(reached(packument('2.0.0-alpha.21', '2.0.0-rc.1'), beta)).toBe('2.0.0-rc.1')
    expect(reached(packument('2.0.0-beta.3'), stable)).toBeUndefined()
  })

  it('reports the newest version once the stable release is out', () => {
    const later = packument('2.0.0-beta.3', '2.0.0', '2.0.1', '2.1.0-beta.0')
    expect(reached(later, stable)).toBe('2.0.1')
    expect(reached(later, beta)).toBe('2.1.0-beta.0')
  })

  it('keeps milestone ids unique, so each comment is posted once', () => {
    const ids = WATCHES.flatMap((watch) => watch.milestones.map((m) => m.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ends the comment with the marker that dedupes it', () => {
    const body = commentBody(vitepress, beta, '2.0.0-beta.0')
    expect(body).toContain('`vitepress@2.0.0-beta.0`')
    expect(body.endsWith(marker(beta))).toBe(true)
  })
})

describe('commenting on watched issues', () => {
  /** Подставной GitHub: состояние issue и уже оставленные комментарии; POST-ы копятся в posted */
  function fakeGitHub(state: string, comments: string[] = []) {
    const posted: { path: string; body: string }[] = []
    const gh: GitHub = async (path, init) => {
      if (init?.method === 'POST') {
        posted.push({ path, body: JSON.parse(String(init.body)).body })
        return Response.json({})
      }
      if (path.endsWith('/comments?per_page=100'))
        return Response.json(comments.map((body) => ({ body })))
      return Response.json({ state })
    }
    return { gh, posted }
  }

  const betaOut = () =>
    statuses({
      async packument() {
        return packument('1.6.4', '2.0.0-alpha.21', '2.0.0-beta.0')
      }
    })

  it('posts once per milestone that came out, and only that one', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const { gh, posted } = fakeGitHub('open')
    await notify(await betaOut(), gh)
    expect(posted).toEqual([
      { path: '/issues/103/comments', body: commentBody(vitepress, beta, '2.0.0-beta.0') }
    ])
  })

  it('stays quiet when the issue already has the marker or is closed', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const marked = fakeGitHub('open', [`раньше\n${marker(beta)}`])
    await notify(await betaOut(), marked.gh)
    const closed = fakeGitHub('closed')
    await notify(await betaOut(), closed.gh)
    expect([...marked.posted, ...closed.posted]).toEqual([])
  })
})
