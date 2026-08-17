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

  it('clears saved source and translation while keeping direction, method, and tone', () => {
    const storage = memoryStorage()
    const persistence = createPersistence(storage)
    persistence.save({
      ...sample,
      directionControl: 'fixed',
      method: 'idiomatic',
    })
    persistence.clearSourceAndTranslation()
    expect(persistence.load()).toEqual({
      source: '',
      completedTranslation: '',
      direction: 'ja-to-en',
      directionControl: 'fixed',
      method: 'idiomatic',
      tone: 'chat',
    })
  })
})
