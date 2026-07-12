import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../../../..')

describe('CodeSwitcher Playground template ref ownership', () => {
  it('does not bind the controller object as a Vue template ref', () => {
    const component = readFileSync(
      resolve(root, '.vitepress/theme/components/CodeSwitcher.vue'),
      'utf8'
    )

    expect(component).toContain("useTemplateRef<{ lifecycle: PlaygroundLifecycle }>('playgroundElement')")
    expect(component).toContain('ref="playgroundElement"')
    expect(component).not.toContain('ref="playground"')
  })
})
