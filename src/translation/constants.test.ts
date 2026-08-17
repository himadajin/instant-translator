import { describe, expect, it } from 'vitest'
import { parseInferencePort } from './constants'

describe('parseInferencePort', () => {
  it('defaults to 8080 when unset', () => {
    expect(parseInferencePort(undefined)).toBe(8080)
  })

  it('accepts a port in range', () => {
    expect(parseInferencePort('1')).toBe(1)
    expect(parseInferencePort('8081')).toBe(8081)
    expect(parseInferencePort('65535')).toBe(65535)
  })

  it('trims surrounding whitespace', () => {
    expect(parseInferencePort(' 8081 ')).toBe(8081)
  })

  it('rejects empty, non-integer, and out-of-range values', () => {
    for (const value of [
      '',
      '   ',
      'abc',
      '8081.5',
      '8081a',
      '-1',
      '0',
      '65536',
    ]) {
      expect(() => parseInferencePort(value)).toThrow(/INFERENCE_PORT/)
    }
  })
})
