import { STORAGE_KEY } from './constants'
import type { KeyValueStorage, WorkState } from './types'

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
  }
}

function isWorkState(value: unknown): value is WorkState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const completedTranslation = record.completedTranslation
  const completedSource = record.completedSource
  const completedDirection = record.completedDirection
  const completedIdiomatic = record.completedIdiomatic
  const completedTone = record.completedTone

  const hasNoCompletedTranslation =
    completedTranslation === '' &&
    completedSource === '' &&
    completedDirection === null &&
    completedIdiomatic === null &&
    completedTone === null
  const hasCompletedTranslation =
    typeof completedTranslation === 'string' &&
    completedTranslation.length > 0 &&
    typeof completedSource === 'string' &&
    completedSource.length > 0 &&
    (completedDirection === 'ja-to-en' || completedDirection === 'en-to-ja') &&
    typeof completedIdiomatic === 'boolean' &&
    (completedTone === 'standard' ||
      completedTone === 'chat' ||
      completedTone === 'technical' ||
      completedTone === 'casual')

  return (
    typeof record.source === 'string' &&
    (hasNoCompletedTranslation || hasCompletedTranslation) &&
    (record.direction === 'ja-to-en' || record.direction === 'en-to-ja') &&
    (record.directionControl === 'auto' ||
      record.directionControl === 'fixed') &&
    typeof record.idiomatic === 'boolean' &&
    (record.tone === 'standard' ||
      record.tone === 'chat' ||
      record.tone === 'technical' ||
      record.tone === 'casual')
  )
}
