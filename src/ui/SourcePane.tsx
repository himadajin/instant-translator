import { forwardRef } from 'react'
import styles from '../styles/Pane.module.css'

export const SourcePane = forwardRef<
  HTMLTextAreaElement,
  {
    sourceText: string
    sourceLength: number
    overLimit: boolean
    inputLimit: number
    inputWarnAt: number
    onSourceTextChange: (text: string) => void
    onClear: () => void
  }
>(function SourcePane(
  {
    sourceText,
    sourceLength,
    overLimit,
    inputLimit,
    inputWarnAt,
    onSourceTextChange,
    onClear,
  },
  ref,
) {
  const isNearLimit = sourceLength > inputWarnAt

  return (
    <section className={styles.pane} aria-label="原文">
      <div className={styles.paneHeader}>
        <span className={styles.metaLabel}>SOURCE</span>
        <button
          type="button"
          className={styles.paneAction}
          onClick={onClear}
          disabled={sourceLength === 0}
        >
          CLEAR
        </button>
      </div>

      <textarea
        ref={ref}
        className={styles.textarea}
        value={sourceText}
        onChange={(event) => onSourceTextChange(event.target.value)}
        placeholder="入力すると自動で翻訳します"
        aria-label="原文"
        autoFocus
      />

      <div className={styles.paneFooter}>
        {overLimit ? (
          <span className={styles.charCount} data-over-limit="true">
            原文が {inputLimit.toLocaleString()} 文字を{' '}
            {(sourceLength - inputLimit).toLocaleString()} 文字超過しています
          </span>
        ) : (
          <span
            className={styles.charCount}
            data-near-limit={isNearLimit || undefined}
          >
            {sourceLength.toLocaleString()}/{inputLimit.toLocaleString()}
          </span>
        )}
      </div>
    </section>
  )
})
