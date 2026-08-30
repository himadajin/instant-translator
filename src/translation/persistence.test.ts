import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from './constants'
import { createPersistence } from './persistence'
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
  completedDirection: 'ja-to-en',
  completedIdiomatic: false,
  completedTone: 'chat',
  sourceLanguage: 'auto',
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

  it('accepts an empty completed-result record', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    const empty: WorkState = {
      source: 'こんにちは',
      completedTranslation: '',
      completedSource: '',
      completedDirection: null,
      completedIdiomatic: null,
      completedTone: null,
      sourceLanguage: 'auto',
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
})
