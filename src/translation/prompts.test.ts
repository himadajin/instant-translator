import { describe, expect, it } from 'vitest'
import { buildMessages } from './prompts'

const source = 'こんにちは。\n\n元気ですか。'

describe('Prompts', () => {
  it('sends a single user message with the source first and the tasks after', () => {
    const messages = buildMessages({
      source,
      direction: 'ja-to-en',
      idiomatic: false,
      tone: 'standard',
    })

    expect(messages).toHaveLength(1)
    expect(messages[0]?.role).toBe('user')

    const content = messages[0]!.content
    expect(content.startsWith(`[Source Text]\n${source}\n`)).toBe(true)
    expect(content).toContain('[Translation Tasks]')
    expect(content.indexOf(source)).toBeLessThan(
      content.indexOf('[Translation Tasks]'),
    )
    expect(content).toContain(
      'Only output the translated result without any additional explanation.',
    )
    expect(content).toContain(
      'Do not add facts, claims, emotions, or proper nouns that are not in the source.',
    )
    expect(content).toContain('Translate the entire [Source Text] into English')
  })

  it('targets Japanese for the English to Japanese direction', () => {
    const messages = buildMessages({
      source: 'Hello.',
      direction: 'en-to-ja',
      idiomatic: false,
      tone: 'standard',
    })

    expect(messages[0]?.content).toContain(
      'Translate the entire [Source Text] into Japanese',
    )
  })

  it('lists the tasks as a numbered sequence', () => {
    const content =
      buildMessages({
        source: 'Hello.',
        direction: 'en-to-ja',
        idiomatic: false,
        tone: 'standard',
      }).at(0)?.content ?? ''

    const tasks = content
      .split('[Translation Tasks]\n')[1]!
      .split('\n')
      .filter(Boolean)
    tasks.forEach((task, index) => {
      expect(task.startsWith(`${index + 1}. `)).toBe(true)
    })
    expect(tasks.at(-1)).toContain('Translate the entire [Source Text]')
  })

  it('always translates naturally and applies idiomatic polishing when enabled', () => {
    const content = (input: Parameters<typeof buildMessages>[0]): string =>
      buildMessages(input).at(0)?.content ?? ''

    const base = {
      source: 'Hello.',
      direction: 'en-to-ja',
    } as const

    expect(content({ ...base, idiomatic: false, tone: 'standard' })).toContain(
      "Write natural Japanese that preserves the source's meaning, information, and nuance.",
    )
    expect(
      content({ ...base, idiomatic: false, tone: 'standard' }),
    ).not.toContain(
      'turning incomplete or messy wording into well-formed writing',
    )
    expect(content({ ...base, idiomatic: false, tone: 'standard' })).toContain(
      "Preserve the source's own tone.",
    )
    expect(content({ ...base, idiomatic: true, tone: 'chat' })).toContain(
      'turning incomplete or messy wording into well-formed writing',
    )
    expect(content({ ...base, idiomatic: true, tone: 'chat' })).toContain(
      'workplace-chat wording suitable for Slack or Teams',
    )
    expect(content({ ...base, idiomatic: false, tone: 'technical' })).toContain(
      'Markdown structure intact',
    )
    expect(content({ ...base, idiomatic: false, tone: 'casual' })).toContain(
      'friendly wording suitable for a friend or social media',
    )
  })
})
