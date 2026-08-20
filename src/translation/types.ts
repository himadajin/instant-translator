export type TranslationDirection = 'ja-to-en' | 'en-to-ja'

export type Language = 'japanese' | 'english'

export type SourceLanguage = 'auto' | Language

export type Tone = 'standard' | 'chat' | 'technical' | 'casual'

export type TranslationStatus =
  | 'idle'
  | 'waiting'
  | 'translating'
  | 'complete'
  | 'language-conflict'
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
  sourceLanguage: SourceLanguage
  targetLanguage: Language
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
  sourceLanguage: SourceLanguage
  targetLanguage: Language
  detectedLanguage: DetectedLanguage
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
