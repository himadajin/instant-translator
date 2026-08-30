import { describe, expect, it } from 'vitest'
import {
  createDefaultProfileState,
  normalizeBaseUrl,
  parseParametersJson,
  validateProfileDraft,
} from './profiles'

describe('Profiles', () => {
  it('seeds a single local llama.cpp profile with the Hy-MT2 sampling values', () => {
    const state = createDefaultProfileState()
    expect(state.profiles).toHaveLength(1)
    const profile = state.profiles[0]!
    expect(state.selectedId).toBe(profile.id)
    expect(profile.name).toBe('llama.cpp (ローカル)')
    expect(profile.baseUrl).toBe('http://127.0.0.1:8080/v1')
    expect(profile.apiKey).toBe('')
    expect(profile.model).toBe('')
    expect(profile.parameters).toEqual({
      temperature: 0.7,
      top_p: 0.6,
      top_k: 20,
      repeat_penalty: 1.05,
    })
  })

  it('normalizes a base URL by trimming whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl(' https://api.openai.com/v1/ ')).toBe(
      'https://api.openai.com/v1',
    )
    expect(normalizeBaseUrl('http://127.0.0.1:8080/v1')).toBe(
      'http://127.0.0.1:8080/v1',
    )
  })

  it('requires a name and a valid http(s) base URL', () => {
    expect(
      validateProfileDraft({ name: 'A', baseUrl: 'https://x.example/v1' }),
    ).toEqual({})
    expect(validateProfileDraft({ name: '  ', baseUrl: '' })).toEqual({
      name: 'required',
      baseUrl: 'required',
    })
    expect(validateProfileDraft({ name: 'A', baseUrl: 'not a url' })).toEqual({
      baseUrl: 'invalid',
    })
    expect(
      validateProfileDraft({ name: 'A', baseUrl: 'ftp://x.example' }),
    ).toEqual({ baseUrl: 'invalid' })
  })

  it('parses parameters as a JSON object and treats empty text as no parameters', () => {
    expect(parseParametersJson('')).toEqual({ ok: true, value: {} })
    expect(parseParametersJson('  {"temperature": 0.3}  ')).toEqual({
      ok: true,
      value: { temperature: 0.3 },
    })
  })

  it('rejects non-object parameters and reserved keys', () => {
    expect(parseParametersJson('not json')).toEqual({
      ok: false,
      reason: 'invalid-json',
    })
    expect(parseParametersJson('[1]')).toEqual({
      ok: false,
      reason: 'not-object',
    })
    expect(parseParametersJson('"text"')).toEqual({
      ok: false,
      reason: 'not-object',
    })
    for (const key of ['messages', 'stream', 'model']) {
      expect(parseParametersJson(`{"${key}": 1}`)).toEqual({
        ok: false,
        reason: 'reserved-key',
        key,
      })
    }
  })
})
