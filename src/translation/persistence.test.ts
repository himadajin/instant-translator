import { describe, expect, it } from 'vitest'
import { PROFILES_STORAGE_KEY, STORAGE_KEY } from './constants'
import { createPersistence } from './persistence'
import type { ProfileState } from './profiles'
import type { KeyValueStorage, WorkState } from './types'

function memoryStorage(initial?: Record<string, string>): KeyValueStorage {
  const data = new Map(Object.entries(initial ?? {}))
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

const sample: WorkState = {
  source: 'こんにちは',
  completedTranslation: 'Hello',
  completedSource: 'こんにちは',
  completedSourceLanguage: 'unspecified',
  completedTargetLanguage: 'english',
  completedIdiomatic: false,
  completedTone: 'chat',
  sourceLanguage: 'unspecified',
  targetLanguage: 'english',
  idiomatic: false,
  tone: 'chat',
}

describe('Persistence', () => {
  it('saves and restores work state under one app-specific key', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    persistence.save(sample)
    expect(JSON.parse(storage.getItem(STORAGE_KEY) ?? '')).toEqual(sample)
    expect(persistence.load()).toEqual(sample)
  })

  it('does not overwrite a completed translation when saving a later source only', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    persistence.save(sample)
    persistence.save({ ...sample, source: 'ありがとう' })
    expect(persistence.load()?.completedTranslation).toBe('Hello')
    expect(persistence.load()?.source).toBe('ありがとう')
  })

  it('rejects the old state shape without completed-result provenance', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        source: sample.source,
        completedTranslation: sample.completedTranslation,
        direction: 'ja-to-en',
        directionControl: 'auto',
        method: 'standard',
        tone: sample.tone,
      }),
    )
    expect(persistence.load()).toBeNull()
  })

  it("rejects the removed 'auto' source-language value", () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...sample, sourceLanguage: 'auto' }),
    )
    expect(persistence.load()).toBeNull()
  })

  it('accepts an empty completed-result record', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    const empty: WorkState = {
      source: 'こんにちは',
      completedTranslation: '',
      completedSource: '',
      completedSourceLanguage: null,
      completedTargetLanguage: null,
      completedIdiomatic: null,
      completedTone: null,
      sourceLanguage: 'unspecified',
      targetLanguage: 'english',
      idiomatic: false,
      tone: 'standard',
    }
    persistence.save(empty)
    expect(persistence.load()).toEqual(empty)
  })

  it('rejects equal explicitly selected source and target languages', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...sample,
        sourceLanguage: 'english',
        targetLanguage: 'english',
      }),
    )

    expect(persistence.load()).toBeNull()
  })

  it('saves and restores profiles under their own key', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    const state: ProfileState = {
      profiles: [
        {
          id: 'a',
          name: 'llama.cpp (ローカル)',
          baseUrl: 'http://127.0.0.1:8080/v1',
          apiKey: '',
          model: '',
          parameters: { temperature: 0.7 },
        },
        {
          id: 'b',
          name: 'OpenRouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: 'or-key',
          model: 'some/model',
          parameters: {},
        },
      ],
      selectedId: 'b',
    }
    persistence.saveProfiles(state)
    expect(JSON.parse(storage.getItem(PROFILES_STORAGE_KEY) ?? '')).toEqual(
      state,
    )
    expect(persistence.loadProfiles()).toEqual(state)
  })

  it('discards invalid profile states instead of migrating them', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    const cases: unknown[] = [
      { profiles: [], selectedId: '' },
      { profiles: [{ id: 'a' }], selectedId: 'a' },
      {
        profiles: [
          {
            id: 'a',
            name: 'x',
            baseUrl: 'http://127.0.0.1:8080/v1',
            apiKey: '',
            model: '',
            parameters: {},
          },
        ],
        selectedId: 'missing',
      },
      'not an object',
    ]
    for (const state of cases) {
      storage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state))
      expect(persistence.loadProfiles()).toBeNull()
    }
    storage.setItem(PROFILES_STORAGE_KEY, 'not json')
    expect(persistence.loadProfiles()).toBeNull()
  })
})
