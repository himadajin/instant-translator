import { describe, expect, it } from 'vitest'
import { buildMessages } from './prompts'

const source = 'こんにちは。\n\n元気ですか。'

describe('Prompts', () => {
  it('sends a single user message with the instruction and the source', () => {
    const messages = buildMessages({
      source,
      direction: 'ja-to-en',
      method: 'standard',
      tone: 'standard',
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.role).toBe('user')

    const [instruction, ...rest] = messages[0]!.content.split('\n\n')
    expect(instruction).toContain(
      'Please translate the following text into English.',
    )
    expect(instruction).toContain('strictly conform to [')
    expect(instruction).toContain(
      'Only output the translated result without any additional explanation.',
    )
    expect(instruction).toContain(
      'Do not add facts, claims, emotions, or proper nouns that are not in the source.',
    )
    expect(rest.join('\n\n')).toBe(source)
  })

  it('targets Japanese for the English to Japanese direction', () => {
    const messages = buildMessages({
      source: 'Hello.',
      direction: 'en-to-ja',
      method: 'standard',
      tone: 'standard',
    })

    expect(messages[0]?.content).toContain(
      'Please translate the following text into Japanese.',
    )
    expect(messages[0]?.content.endsWith('\n\nHello.')).toBe(true)
  })

  it('describes the method and the tone inside the style brackets', () => {
    const style = (
      input: Parameters<typeof buildMessages>[0],
    ): string | undefined =>
      /strictly conform to \[(.+?)\]\./.exec(
        buildMessages(input).at(0)?.content ?? '',
      )?.[1]

    const base = {
      source: 'Hello.',
      direction: 'en-to-ja',
    } as const

    expect(style({ ...base, method: 'standard', tone: 'standard' })).toBe(
      "natural Japanese that preserves the source's meaning, information, and nuance; the source's own tone preserved",
    )
    expect(style({ ...base, method: 'idiomatic', tone: 'chat' })).toBe(
      "polished Japanese that keeps the author's intent and factual relations while turning incomplete or messy wording into well-formed writing; concise, natural workplace-chat wording suitable for Slack or Teams, never rude",
    )
    expect(style({ ...base, method: 'standard', tone: 'technical' })).toContain(
      'Markdown structure kept intact',
    )
    expect(style({ ...base, method: 'standard', tone: 'casual' })).toContain(
      'friendly wording suitable for a friend or social media',
    )
  })
})
