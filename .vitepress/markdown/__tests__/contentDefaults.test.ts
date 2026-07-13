import { describe, expect, it } from 'vitest'
import { redundantMultiCodeDefaults } from '../../shared/core/contentQuality'

describe('public multi-code defaults', () => {
  it('classifies redundant defaults for every language', () => {
    expect(
      redundantMultiCodeDefaults(`
::: multi-code "Example" {default=java}
\`\`\`java
class Example {}
\`\`\`
\`\`\`go
package main
\`\`\`
:::
`)
    ).toEqual([
      {
        line: 2,
        header: '::: multi-code "Example" {default=java}'
      }
    ])

    expect(
      redundantMultiCodeDefaults(`
::: multi-code "Intentional" {default=go}
\`\`\`java
class Example {}
\`\`\`
\`\`\`go
package main
\`\`\`
:::
`)
    ).toEqual([])
  })
})
