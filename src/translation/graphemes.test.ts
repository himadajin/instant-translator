import { describe, expect, it } from 'vitest'
import { countGraphemes } from './graphemes'

describe('countGraphemes', () => {
  it('counts a supplementary-plane emoji as one character', () => {
    expect(countGraphemes('😀')).toBe(1)
  })

  it('counts a combining sequence as one character', () => {
    expect(countGraphemes('e\u0301')).toBe(1)
  })

  it('counts a ZWJ emoji sequence as one character', () => {
    expect(countGraphemes('👩‍👩‍👧‍👦')).toBe(1)
  })
})
