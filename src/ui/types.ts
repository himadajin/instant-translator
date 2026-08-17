/**
 * Shared types for the translation workspace UI.
 *
 * These mirror the domain language defined in `CONTEXT.md` and the component
 * boundaries in `docs/internal/specs/components.md`. This module intentionally
 * has no dependency on `src/translation`; the UI only knows about the shapes
 * of the values it renders and the callbacks it invokes.
 */

export type ConnectionStatus = 'ready' | 'checking' | 'unavailable'

/** The direction currently shown in the language direction bar (source -> target). */
export type TranslationDirection = 'jaToEn' | 'enToJa'

export type TranslationMode = 'standard' | 'paraphrase'

export type Tone = 'standard' | 'chat' | 'technical' | 'casual'

/**
 * The translation pane's display state. `idle` covers both "no source text
 * yet" and "waiting for the debounce before a translation starts" is split
 * out as `pending` so the pane can show a dimmed previous result per ui.md.
 */
export type TranslationStatus =
  | 'idle'
  | 'pending'
  | 'streaming'
  | 'done'
  | 'connectionError'
  | 'translationError'
  | 'overLimit'

export const SOURCE_CHAR_LIMIT = 4000
export const SOURCE_CHAR_WARNING_THRESHOLD = 3200

export const TONE_OPTIONS: readonly { value: Tone; label: string }[] = [
  { value: 'standard', label: '標準' },
  { value: 'chat', label: 'チャット' },
  { value: 'technical', label: '技術文書' },
  { value: 'casual', label: 'カジュアル' },
]

export interface WorkspaceProps {
  /** Current connection state to the local inference server. */
  connectionStatus: ConnectionStatus

  /** The text the user is translating. Controlled by the caller. */
  sourceText: string
  onSourceTextChange: (text: string) => void
  /** Clears the source text. Only invoked while `sourceText` is non-empty. */
  onClear: () => void

  /** The direction currently resolved for display (source -> target). */
  direction: TranslationDirection
  /** `true` when the direction is user-fixed; `false` while auto-detecting. */
  isDirectionFixed: boolean
  /** Invoked by the `⇄` control: swaps and fixes the direction. */
  onSwapDirection: () => void
  /** Invoked by pressing the `FIXED` label: returns to auto-detection. */
  onReleaseFixedDirection: () => void

  translationMode: TranslationMode
  onTranslationModeChange: (mode: TranslationMode) => void

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
