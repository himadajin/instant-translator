import type { Language, SourceLanguage } from './types'

export const LANGUAGE_NAMES: Record<Language, string> = {
  japanese: '日本語',
  english: 'English',
}

export const SOURCE_LANGUAGE_OPTIONS: readonly {
  value: SourceLanguage
  label: string
}[] = [
  { value: 'auto', label: '自動判定' },
  { value: 'japanese', label: LANGUAGE_NAMES.japanese },
  { value: 'english', label: LANGUAGE_NAMES.english },
]

export const TARGET_LANGUAGE_OPTIONS: readonly {
  value: Language
  label: string
}[] = [
  { value: 'japanese', label: LANGUAGE_NAMES.japanese },
  { value: 'english', label: LANGUAGE_NAMES.english },
]
