export type TranslationDirection = 'ja-to-en' | 'en-to-ja'

export type DirectionControl = 'auto' | 'fixed'

export type Tone = 'standard' | 'chat' | 'technical' | 'casual'

export type TranslationStatus =
  | 'idle'
  | 'waiting'
  | 'translating'
  | 'complete'
  | 'connection-failed'
  | 'translation-failed'

export type ConnectionStatus = 'checking' | 'ready' | 'unavailable'

export type DetectedLanguage = 'japanese' | 'english' | 'ambiguous'

export type ChatMessage = {
  role: 'user'
  content: string
}

export type WorkState = {
  source: string
  completedTranslation: string
  completedSource: string
  completedDirection: TranslationDirection | null
  completedIdiomatic: boolean | null
  completedTone: Tone | null
  direction: TranslationDirection
  directionControl: DirectionControl
  idiomatic: boolean
  tone: Tone
}

export type WorkspaceState = WorkState & {
  translation: string
  translationIsCurrent: boolean
  translationStatus: TranslationStatus
  connectionStatus: ConnectionStatus
}

export type WorkspaceSnapshot = {
  source: string
  translation: string
  translationIsCurrent: boolean
  direction: TranslationDirection
  directionControl: DirectionControl
  idiomatic: boolean
  tone: Tone
  translationStatus: TranslationStatus
  connectionStatus: ConnectionStatus
  sourceLength: number
  overLimit: boolean
}

export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
