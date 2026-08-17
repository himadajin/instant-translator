import { STORAGE_KEY } from './constants'
import type { KeyValueStorage, WorkState } from './types'

const defaultWorkState: WorkState = {
  source: '',
  completedTranslation: '',
  direction: 'ja-to-en',
  directionControl: 'auto',
  method: 'standard',
  tone: 'standard',
}

export function createPersistence(storage: KeyValueStorage) {
  return {
    load(): WorkState | null {
      const raw = storage.getItem(STORAGE_KEY)
      if (raw === null) {
        return null
      }
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!isWorkState(parsed)) {
          return null
        }
        return parsed
      } catch {
        return null
      }
    },

    save(state: WorkState): void {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    },

    clearSourceAndTranslation(): void {
      const current = this.load() ?? defaultWorkState
      this.save({
        ...current,
        source: '',
        completedTranslation: '',
      })
    },
  }
}

function isWorkState(value: unknown): value is WorkState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.source === 'string' &&
    typeof record.completedTranslation === 'string' &&
    (record.direction === 'ja-to-en' || record.direction === 'en-to-ja') &&
    (record.directionControl === 'auto' ||
      record.directionControl === 'fixed') &&
    (record.method === 'standard' || record.method === 'idiomatic') &&
    (record.tone === 'standard' ||
      record.tone === 'chat' ||
      record.tone === 'technical' ||
      record.tone === 'casual')
  )
}
