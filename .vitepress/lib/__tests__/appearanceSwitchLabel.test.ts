import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  APPEARANCE_SWITCH_LABEL,
  appearanceSwitchLabelPlugin,
  labelAppearanceSwitch
} from '../appearanceSwitchLabel'

const require = createRequire(import.meta.url)
const vitepressRoot = dirname(require.resolve('vitepress/package.json'))
const switchSource = readFileSync(
  join(vitepressRoot, 'dist/client/theme-default/components/VPSwitchAppearance.vue'),
  'utf8'
)

describe('appearance switch label', () => {
  it('labels the installed VitePress switch template', () => {
    expect(labelAppearanceSwitch(switchSource)).toContain(`aria-label="${APPEARANCE_SWITCH_LABEL}"`)
  })

  it('fails loudly when the VitePress template changes', () => {
    expect(() => labelAppearanceSwitch('<template><button /></template>')).toThrow(
      /VPSwitchAppearance/
    )
  })

  it('transforms only the component module itself', () => {
    const plugin = appearanceSwitchLabelPlugin()
    const transform = plugin.transform as (code: string, id: string) => string | null
    expect(transform(switchSource, '/x/components/VPSwitchAppearance.vue')).toContain('aria-label')
    expect(
      transform(switchSource, '/x/components/VPSwitchAppearance.vue?vue&type=style')
    ).toBeNull()
    expect(transform(switchSource, '/x/components/VPSwitch.vue')).toBeNull()
    expect(transform(switchSource, 'C:\\x\\components\\VPSwitchAppearance.vue')).toContain(
      'aria-label'
    )
  })
})
