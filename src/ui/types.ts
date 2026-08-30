/**
 * Shared types for the translation workspace UI.
 *
 * These mirror the domain language defined in `CONTEXT.md` and the component
 * boundaries in `docs/internal/specs/components.md`. Tone is imported from
 * the translation domain so the UI does not redefine its values.
 */

import type {
  DetectedLanguage,
  Language,
  Profile,
  ProfileDraft,
  SourceLanguage,
  Tone,
} from '../translation'

export type {
  DetectedLanguage,
  Language,
  Profile,
  ProfileDraft,
  SourceLanguage,
  Tone,
}

export type ConnectionStatus =
  'ready' | 'checking' | 'unavailable' | 'auth-failed'

/**
 * The translation pane's display state. `idle` covers both "no source text
 * yet"; waiting for the debounce before a translation starts is represented
 * by `pending` so the pane can show a dimmed previous result per ui.md.
 */
export type TranslationStatus =
  | 'idle'
  | 'pending'
  | 'streaming'
  | 'done'
  | 'languageConflict'
  | 'connectionError'
  | 'authError'
  | 'translationError'
  | 'overLimit'

export const TONE_OPTIONS: readonly { value: Tone; label: string }[] = [
  { value: 'standard', label: '標準' },
  { value: 'chat', label: 'チャット' },
  { value: 'technical', label: '技術文書' },
  { value: 'casual', label: 'カジュアル' },
]

export interface WorkspaceProps {
  /** Current connection state to the selected profile's inference target. */
  connectionStatus: ConnectionStatus

  /** Registered profiles, in registration order. Never empty once loaded. */
  profiles: readonly Profile[]
  /** Id of the profile used for translation. */
  selectedProfileId: string
  onProfileSelect: (id: string) => void
  onProfileAdd: (draft: ProfileDraft) => void
  onProfileUpdate: (id: string, draft: ProfileDraft) => void
  /** Only invoked while two or more profiles exist. */
  onProfileDelete: (id: string) => void

  /** The text the user is translating. Controlled by the caller. */
  sourceText: string
  /** Number of user-perceived characters in `sourceText`. */
  sourceLength: number
  /** Whether `sourceText` exceeds the domain input limit. */
  overLimit: boolean
  /** Domain input limit, in user-perceived characters. */
  inputLimit: number
  /** Domain warning threshold, in user-perceived characters. */
  inputWarnAt: number
  onSourceTextChange: (text: string) => void
  /** Clears the source text. Only invoked while `sourceText` is non-empty. */
  onClear: () => void

  sourceLanguage: SourceLanguage
  targetLanguage: Language
  detectedLanguage: DetectedLanguage
  onSourceLanguageChange: (language: SourceLanguage) => void
  onTargetLanguageChange: (language: Language) => void

  idiomatic: boolean
  onIdiomaticChange: (idiomatic: boolean) => void

  tone: Tone
  onToneChange: (tone: Tone) => void

  translationStatus: TranslationStatus
  /** The current (possibly partial) translated text for `streaming` / `done`. */
  translatedText: string
  /** The last completed translation, shown dimmed while `pending`. */
  previousTranslatedText?: string
  /** Invoked when the user presses COPY. May resolve/reject asynchronously. */
  onCopy: () => void | Promise<void>
  /** Invoked from the retry action shown on connection/translation failure. */
  onRetry: () => void
}
