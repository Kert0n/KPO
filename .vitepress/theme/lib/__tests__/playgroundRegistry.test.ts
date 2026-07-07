import { describe, expect, it } from 'vitest'
import {
  readPlaygroundCode,
  readPlaygroundSelection,
  registerPlayground,
  unregisterPlayground,
  updatePlaygroundCode
} from '../playgroundRegistry'

describe('playgroundRegistry', () => {
  it('returns current playground code and CodeMirror selection', () => {
    registerPlayground('block-1', 'initial', {
      getCode: () => 'edited',
      codemirror: {
        getSelection: () => 'selected code'
      }
    })

    expect(readPlaygroundCode('block-1')).toBe('edited')
    expect(readPlaygroundSelection('block-1')).toBe('selected code')

    unregisterPlayground('block-1')
  })

  it('falls back to cached code when instance is unavailable', () => {
    registerPlayground('block-2', 'initial')
    updatePlaygroundCode('block-2', 'cached edit')

    expect(readPlaygroundCode('block-2')).toBe('cached edit')

    unregisterPlayground('block-2')
  })
})
