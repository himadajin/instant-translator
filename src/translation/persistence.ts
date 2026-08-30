import { PROFILES_STORAGE_KEY, STORAGE_KEY } from './constants'
import type { Profile, ProfileState } from './profiles'
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

    loadProfiles(): ProfileState | null {
      const raw = storage.getItem(PROFILES_STORAGE_KEY)
      if (raw === null) {
        return null
      }
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!isProfileState(parsed)) {
          return null
        }
        return parsed
      } catch {
        return null
      }
    },

    saveProfiles(state: ProfileState): void {
      storage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state))
    },
  }
}

function isProfileState(value: unknown): value is ProfileState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.profiles) || record.profiles.length === 0) {
    return false
  }
  if (!record.profiles.every(isProfile)) {
    return false
  }
  const profiles = record.profiles as Profile[]
  return (
    typeof record.selectedId === 'string' &&
    profiles.some((profile) => profile.id === record.selectedId)
  )
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    record.id.length > 0 &&
    typeof record.name === 'string' &&
    typeof record.baseUrl === 'string' &&
    typeof record.apiKey === 'string' &&
    typeof record.model === 'string' &&
    typeof record.parameters === 'object' &&
    record.parameters !== null &&
    !Array.isArray(record.parameters)
  )
}

function isWorkState(value: unknown): value is WorkState {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const completedTranslation = record.completedTranslation
  const completedSource = record.completedSource
  const completedSourceLanguage = record.completedSourceLanguage
  const completedTargetLanguage = record.completedTargetLanguage
  const completedIdiomatic = record.completedIdiomatic
  const completedTone = record.completedTone
  const hasValidLanguageSelection =
    (record.sourceLanguage === 'unspecified' ||
      record.sourceLanguage === 'japanese' ||
      record.sourceLanguage === 'english') &&
    (record.targetLanguage === 'japanese' ||
      record.targetLanguage === 'english') &&
    (record.sourceLanguage === 'unspecified' ||
      record.sourceLanguage !== record.targetLanguage)

  const hasNoCompletedTranslation =
    completedTranslation === '' &&
    completedSource === '' &&
    completedSourceLanguage === null &&
    completedTargetLanguage === null &&
    completedIdiomatic === null &&
    completedTone === null
  const hasCompletedTranslation =
    typeof completedTranslation === 'string' &&
    completedTranslation.length > 0 &&
    typeof completedSource === 'string' &&
    completedSource.length > 0 &&
    (completedSourceLanguage === 'unspecified' ||
      completedSourceLanguage === 'japanese' ||
      completedSourceLanguage === 'english') &&
    (completedTargetLanguage === 'japanese' ||
      completedTargetLanguage === 'english') &&
    typeof completedIdiomatic === 'boolean' &&
    (completedTone === 'standard' ||
      completedTone === 'chat' ||
      completedTone === 'technical' ||
      completedTone === 'casual')

  return (
    typeof record.source === 'string' &&
    (hasNoCompletedTranslation || hasCompletedTranslation) &&
    hasValidLanguageSelection &&
    typeof record.idiomatic === 'boolean' &&
    (record.tone === 'standard' ||
      record.tone === 'chat' ||
      record.tone === 'technical' ||
      record.tone === 'casual')
  )
}
