import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  dependabotIgnoresOf,
  issueBody,
  issueTitle,
  locationKey,
  overridesOf,
  PINS,
  type PackageRegistry,
  type Packument
} from '../dependency-pins.mts'

const repoFile = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

const pin = (id: string) => {
  const found = PINS.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`нет пина ${id}`)
  return found
}

/** Подставной реестр: { имя: { latest, versions: { версия: manifest } } } */
function registry(
  packages: Record<
    string,
    { latest: string; versions: Record<string, Packument['versions'][string]> }
  >
): PackageRegistry {
  return {
    async packument(name) {
      const entry = packages[name]
      if (!entry) throw new Error(`нет пакета ${name}`)
      return { 'dist-tags': { latest: entry.latest }, versions: entry.versions }
    }
  }
}

describe('dependency pins registry', () => {
  it('lists exactly the overrides that package.json has', () => {
    const actual = overridesOf(JSON.parse(repoFile('package.json')).overrides).map(locationKey)
    const registered = PINS.flatMap((p) => p.locations)
      .filter((location) => location.kind === 'override')
      .map(locationKey)
    expect(registered.sort()).toEqual(actual.sort())
  })

  it('lists exactly the npm ignore rules that Dependabot has', () => {
    const actual = dependabotIgnoresOf(repoFile('.github/dependabot.yml')).map(locationKey)
    const registered = PINS.flatMap((p) => p.locations)
      .filter((location) => location.kind === 'dependabot')
      .map(locationKey)
    expect(registered.sort()).toEqual(actual.sort())
  })

  it('keeps the docs table in step with the registry', () => {
    const docs = repoFile('docs/dependency-maintenance.md')
    const section = docs.split('## Пины: что держим и когда снимать')[1]?.split('\n## ')[0] ?? ''
    const rows = section
      .split('\n')
      .filter((line) => line.startsWith('|') && !/^\|\s*(Что держим|-)/.test(line))
      .map((line) => line.split('|')[1].trim())
    expect(rows.sort()).toEqual(PINS.map((p) => p.title).sort())
  })

  it('reads overrides and ignore rules in their real shapes', () => {
    expect(overridesOf({ a: '1.0.0', b: { c: { d: '2.0.0' } } }).map(locationKey)).toEqual([
      'override a = 1.0.0',
      'override b › c › d = 2.0.0'
    ])
    const config = [
      'updates:',
      '  - package-ecosystem: npm',
      '    ignore:',
      "      - dependency-name: '@types/x'",
      "        versions: ['1.2.0']",
      '      - dependency-name: y',
      "        update-types: ['version-update:semver-major']",
      '  - package-ecosystem: gradle',
      '    ignore:',
      '      - dependency-name: z',
      "        update-types: ['version-update:semver-major']"
    ].join('\n')
    expect(dependabotIgnoresOf(config).map(locationKey)).toEqual([
      'dependabot @types/x versions:1.2.0',
      'dependabot y semver-major'
    ])
  })
})

describe('dependency pin checks', () => {
  it('lifts the vite override once stable VitePress accepts vite 6.4', async () => {
    const vite = pin('vite-override')
    const held = registry({
      vitepress: { latest: '1.6.4', versions: { '1.6.4': { dependencies: { vite: '^5.4.14' } } } }
    })
    const free = registry({
      vitepress: { latest: '2.0.0', versions: { '2.0.0': { dependencies: { vite: '^6.4.0' } } } }
    })
    expect((await vite.check(held)).ready).toBe(false)
    expect(await vite.check(free)).toEqual({
      ready: true,
      evidence: 'vitepress@2.0.0: vite ^6.4.0'
    })
  })

  it('follows the MathJax chain down to xmldom and ignores prereleases', async () => {
    const xmldom = pin('xmldom-override')
    const chain = (sreXmldom: string) =>
      registry({
        'markdown-it-mathjax3': {
          latest: '5.0.0',
          versions: { '4.3.2': { dependencies: { 'mathjax-full': '^3.2.0' } }, '5.0.0': {} }
        },
        'mathjax-full': {
          latest: '3.2.2',
          versions: { '3.2.2': { dependencies: { 'speech-rule-engine': '^4.0.6' } } }
        },
        'speech-rule-engine': {
          latest: '5.0.0-rc.4',
          versions: {
            '4.1.4': { dependencies: { '@xmldom/xmldom': sreXmldom } },
            '5.0.0-rc.4': { dependencies: { '@xmldom/xmldom': '^0.9.12' } }
          }
        }
      })
    expect((await xmldom.check(chain('0.9.10'))).ready).toBe(false)
    expect((await xmldom.check(chain('^0.9.12'))).ready).toBe(true)
  })

  it('waits for typescript-eslint to allow the newest TypeScript', async () => {
    const typescript = pin('typescript-6')
    const make = (peer: string) =>
      registry({
        'typescript-eslint': {
          latest: '8.80.0',
          versions: { '8.80.0': { peerDependencies: { typescript: peer } } }
        },
        typescript: { latest: '7.0.2', versions: { '7.0.2': {} } }
      })
    expect((await typescript.check(make('>=4.8.4 <6.1.0'))).ready).toBe(false)
    expect((await typescript.check(make('>=4.8.4 <7.1.0'))).ready).toBe(true)
  })

  it('lifts the broken-types hold once a newer @types/markdown-it ships', async () => {
    const types = pin('types-markdown-it-14.2.0')
    const make = (versions: string[]) =>
      registry({
        '@types/markdown-it': {
          latest: versions.at(-1)!,
          versions: Object.fromEntries(versions.map((version) => [version, {}]))
        }
      })
    expect((await types.check(make(['14.1.2', '14.2.0']))).ready).toBe(false)
    expect((await types.check(make(['14.1.2', '14.2.0', '14.2.1']))).ready).toBe(true)
  })

  it('writes an actionable issue', () => {
    const vite = pin('vite-override')
    expect(issueTitle(vite)).toBe('Можно снять пин: vitepress → vite 6.4.5')
    const body = issueBody(vite, { ready: true, evidence: 'vitepress@2.0.0: vite ^6.4.0' })
    expect(body).toContain(vite.liftWhen)
    expect(body).toContain('vitepress → vite = 6.4.5')
    expect(body).toContain('docs/dependency-maintenance.md')
  })
})
