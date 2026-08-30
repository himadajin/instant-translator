import { describe, expect, it } from 'vitest'
import {
  createDefaultProfileState,
  mergeParameters,
  normalizeBaseUrl,
  parseParametersJson,
  parseSamplingFieldText,
  splitParameters,
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
    expect(parseParametersJson('  {"seed": 42}  ')).toEqual({
      ok: true,
      value: { seed: 42 },
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

  it('rejects sampling-field keys in the extra-parameters JSON', () => {
    for (const key of ['temperature', 'top_p', 'top_k', 'repeat_penalty']) {
      expect(parseParametersJson(`{"${key}": 1}`)).toEqual({
        ok: false,
        reason: 'field-key',
        key,
      })
    }
  })

  it('splits parameters into numeric sampling fields and extra keys, and merges them back', () => {
    const parameters = {
      temperature: 0.7,
      top_k: 20,
      provider: { order: ['x'] },
      seed: 42,
    }
    const { fields, extra } = splitParameters(parameters)
    expect(fields).toEqual({ temperature: 0.7, top_k: 20 })
    expect(extra).toEqual({ provider: { order: ['x'] }, seed: 42 })
    expect(mergeParameters(fields, extra)).toEqual(parameters)
  })

  it('leaves a non-numeric value for a known key in the extra keys', () => {
    const { fields, extra } = splitParameters({ temperature: 'hot' })
    expect(fields).toEqual({})
    expect(extra).toEqual({ temperature: 'hot' })
  })

  it('parses sampling field text, treating an empty field as unset', () => {
    expect(parseSamplingFieldText('temperature', '')).toEqual({
      ok: true,
      value: undefined,
    })
    expect(parseSamplingFieldText('temperature', ' 0.7 ')).toEqual({
      ok: true,
      value: 0.7,
    })
    expect(parseSamplingFieldText('top_k', '20')).toEqual({
      ok: true,
      value: 20,
    })
    expect(parseSamplingFieldText('temperature', 'abc')).toEqual({
      ok: false,
      reason: 'not-number',
    })
    expect(parseSamplingFieldText('temperature', 'Infinity')).toEqual({
      ok: false,
      reason: 'not-number',
    })
    expect(parseSamplingFieldText('top_k', '1.5')).toEqual({
      ok: false,
      reason: 'not-integer',
    })
  })
})
