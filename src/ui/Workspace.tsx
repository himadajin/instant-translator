import '../styles/fonts.css'
import '../styles/tokens.css'
import { Header } from './Header'
import { LanguageDirectionBar } from './LanguageDirectionBar'
import { SettingsBar } from './SettingsBar'
import { SourcePane } from './SourcePane'
import { LanguageRail } from './LanguageRail'
import { TranslationPane } from './TranslationPane'
import type { WorkspaceProps } from './types'
import styles from '../styles/Workspace.module.css'

/**
 * The single translation workspace screen. Renders the header, language
 * direction bar, settings bar, and the source/rail/translation panes, in the
 * order defined by docs/internal/specs/ui.md.
 *
 * This component owns no translation logic: it only displays the given
 * state and forwards user actions through the provided callbacks.
 */
export function Workspace({
  connectionStatus,
  sourceText,
  onSourceTextChange,
  onClear,
  direction,
  isDirectionFixed,
  onSwapDirection,
  onReleaseFixedDirection,
  translationMode,
  onTranslationModeChange,
  tone,
  onToneChange,
  translationStatus,
  translatedText,
  previousTranslatedText,
  onCopy,
  onRetry,
}: WorkspaceProps) {
  const isRailActive =
    translationStatus === 'pending' || translationStatus === 'streaming'

  return (
    <div className={styles.app}>
      <Header connectionStatus={connectionStatus} />
      <LanguageDirectionBar
        direction={direction}
        isDirectionFixed={isDirectionFixed}
        onSwapDirection={onSwapDirection}
        onReleaseFixedDirection={onReleaseFixedDirection}
      />
      <SettingsBar
        translationMode={translationMode}
        onTranslationModeChange={onTranslationModeChange}
        tone={tone}
        onToneChange={onToneChange}
      />
      <main className={styles.main}>
        <div className={styles.sourceColumn}>
          <SourcePane
            sourceText={sourceText}
            onSourceTextChange={onSourceTextChange}
            onClear={onClear}
          />
        </div>
        <LanguageRail isActive={isRailActive} />
        <div className={styles.translationColumn}>
          <TranslationPane
            translationStatus={translationStatus}
            translatedText={translatedText}
            previousTranslatedText={previousTranslatedText}
            onCopy={onCopy}
            onRetry={onRetry}
          />
        </div>
      </main>
    </div>
  )
}
