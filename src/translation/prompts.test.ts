import { describe, expect, it } from 'vitest'
import { buildMessages } from './prompts'
import type { Tone, TranslationDirection, TranslationMethod } from './types'

const directions: TranslationDirection[] = ['ja-to-en', 'en-to-ja']
const methods: TranslationMethod[] = ['standard', 'idiomatic']
const tones: Tone[] = ['standard', 'chat', 'technical', 'casual']

describe('Prompts', () => {
  it('builds messages for every direction, method, and tone', () => {
    for (const direction of directions) {
      for (const method of methods) {
        for (const tone of tones) {
          const messages = buildMessages({
            source: '原文',
            direction,
            method,
            tone,
          })
          expect(messages).toHaveLength(2)
          expect(messages[0]?.role).toBe('system')
          expect(messages[1]).toEqual({ role: 'user', content: '原文' })
        }
      }
    }
  })

  it('does not ask the model to detect language', () => {
    const system = buildMessages({
      source: 'hello',
      direction: 'en-to-ja',
      method: 'standard',
      tone: 'standard',
    })[0]?.content
    expect(system).toContain('Do not detect or guess the language')
    expect(system).toContain('English to Japanese')
  })

  it('asks for the translation only', () => {
    const system = buildMessages({
      source: 'hello',
      direction: 'en-to-ja',
      method: 'standard',
      tone: 'standard',
    })[0]?.content
    expect(system).toContain('Output only the translation')
    expect(system).toContain('preamble')
  })

  it('keeps code, identifiers, and Markdown in technical tone', () => {
    const system = buildMessages({
      source: 'See `foo` in README.md',
      direction: 'en-to-ja',
      method: 'standard',
      tone: 'technical',
    })[0]?.content
    expect(system).toContain('code, identifiers, and Markdown')
  })

  it('forbids adding facts or emotions that are not in the source', () => {
    const system = buildMessages({
      source: 'hello',
      direction: 'ja-to-en',
      method: 'idiomatic',
      tone: 'casual',
    })[0]?.content
    expect(system).toContain(
      'Do not add facts, claims, emotions, or proper nouns that are not in the source',
    )
    expect(system).toContain('Do not add slang')
  })

  it('describes workplace chat and adaptive wording', () => {
    const chat = buildMessages({
      source: 'hello',
      direction: 'ja-to-en',
      method: 'standard',
      tone: 'chat',
    })[0]?.content
    const idiomatic = buildMessages({
      source: 'hello',
      direction: 'ja-to-en',
      method: 'idiomatic',
      tone: 'standard',
    })[0]?.content
    expect(chat).toContain('Slack or Teams')
    expect(idiomatic).toContain('incomplete or messy')
  })
})
