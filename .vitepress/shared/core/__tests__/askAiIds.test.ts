import { describe, expect, it } from 'vitest'
import {
  canonicalizeAskAiBlockIdentity,
  canonicalizeMultiCodeIdentity,
  createAskAiBlockId,
  createAskAiBlockIdAllocator
} from '../askAiIds'

const sourcePath = 'content/service-pages/identity-fixture/vitepress.md'
const multiCode = `::: multi-code "Example" {default=kotlin}
\`\`\`kotlin
val value = 1
\`\`\`
\`\`\`java
var value = 1;
\`\`\`
:::`

describe('Ask AI source identities', () => {
  it('uses source coordinates to keep repeated elements distinct', () => {
    const ids = createAskAiBlockIdAllocator(sourcePath)
    const first = ids.next('paragraph', 'Repeated fixture paragraph.', 10, 10)
    const second = ids.next('paragraph', 'Repeated fixture paragraph.', 20, 20)

    expect(first).not.toBe(second)
    expect(first).toMatch(/^kpo-ai-10-paragraph-/)
    expect(second).toMatch(/^kpo-ai-20-paragraph-/)
  })

  it('normalizes absolute and workspace-relative source paths', () => {
    expect(createAskAiBlockId('paragraph', 'Fixture', 3, sourcePath, 3)).toBe(
      createAskAiBlockId('paragraph', 'Fixture', 3, `/workspace/KPO/${sourcePath}`, 3)
    )
  })

  it('changes identity when source range or content changes', () => {
    const original = createAskAiBlockId('code', '```kotlin\nval x = 1\n```', 5, sourcePath, 7)
    const moved = createAskAiBlockId('code', '```kotlin\nval x = 1\n```', 15, sourcePath, 17)
    const changed = createAskAiBlockId('code', '```kotlin\nval x = 2\n```', 5, sourcePath, 7)

    expect(moved).not.toBe(original)
    expect(changed).not.toBe(original)
  })

  it('canonicalizes multi-code presentation separately from its fences', () => {
    const changedPresentation = multiCode
      .replace('"Example"', '"Different label"')
      .replace('{default=kotlin}', '{default=java playground=off}')

    expect(canonicalizeMultiCodeIdentity(changedPresentation)).toBe(
      canonicalizeMultiCodeIdentity(multiCode)
    )
    expect(canonicalizeAskAiBlockIdentity('multi-code', multiCode)).toContain('fence:kotlin')
  })
})
