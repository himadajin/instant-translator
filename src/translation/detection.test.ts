import { describe, expect, it } from 'vitest'
import { detectLanguage } from './detection'

describe('Detection', () => {
  it('classifies Japanese-like source as japanese without calling Inference', () => {
    expect(detectLanguage('こんにちは、今日は良い天気です。')).toBe('japanese')
  })

  it('classifies English-like source as english without calling Inference', () => {
    expect(detectLanguage('Hello, how are you today?')).toBe('english')
  })

  it('treats too-short input as ambiguous', () => {
    expect(detectLanguage('Hi')).toBe('ambiguous')
    expect(detectLanguage('あ')).toBe('ambiguous')
    expect(detectLanguage('東京')).toBe('ambiguous')
    expect(detectLanguage('!@#')).toBe('ambiguous')
  })

  it('treats mixed Japanese and English as ambiguous', () => {
    expect(detectLanguage('This is 日本語の test case')).toBe('ambiguous')
  })
})
