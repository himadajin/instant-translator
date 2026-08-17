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
  completedMethod: 'standard',
  completedTone: 'chat',
  direction: 'ja-to-en',
  directionControl: 'auto',
  method: 'standard',
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
        direction: sample.direction,
        directionControl: sample.directionControl,
        method: sample.method,
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
      completedMethod: null,
      completedTone: null,
      direction: 'ja-to-en',
      directionControl: 'auto',
      method: 'standard',
      tone: 'standard',
    }
    persistence.save(empty)
    expect(persistence.load()).toEqual(empty)
  })
})
