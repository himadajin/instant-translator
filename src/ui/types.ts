/**
 * Shared types for the translation workspace UI.
 *
 * These mirror the domain language defined in `CONTEXT.md` and the component
 * boundaries in `docs/internal/specs/components.md`. Tone is imported from
 * the translation domain so the UI does not redefine its values.
 */

import type {
  Language,
  Profile,
  ProfileDraft,
  SourceLanguage,
  Tone,
} from '../translation'

export type { Language, Profile, ProfileDraft, SourceLanguage, Tone }

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
  | 'connectionError'
  | 'authError'
  | 'translationError'
  | 'overLimit'

/**
 * Tone choices as shown in the translation pane. The labels name the tone
 * itself so the Select needs no floating label, matching the unlabelled
 * language Selects on the same row.
 */
export const TONE_OPTIONS: readonly { value: Tone; label: string }[] = [
  { value: 'standard', label: '標準の口調' },
  { value: 'chat', label: 'チャットの口調' },
  { value: 'technical', label: '技術文書の口調' },
  { value: 'casual', label: 'カジュアルな口調' },
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
  /** Whether a cleared source is kept and the current source is still empty. */
  canRestoreCleared: boolean
  /** Restores the cleared source. Only invoked while `canRestoreCleared`. */
  onRestoreCleared: () => void

  sourceLanguage: SourceLanguage
  targetLanguage: Language
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
