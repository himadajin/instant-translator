import { forwardRef } from 'react'
import { SOURCE_CHAR_LIMIT, SOURCE_CHAR_WARNING_THRESHOLD } from './types'
import styles from '../styles/Pane.module.css'

export const SourcePane = forwardRef<
  HTMLTextAreaElement,
  {
    sourceText: string
    onSourceTextChange: (text: string) => void
    onClear: () => void
  }
>(function SourcePane({ sourceText, onSourceTextChange, onClear }, ref) {
  const length = sourceText.length
  const isOverLimit = length > SOURCE_CHAR_LIMIT
  const isNearLimit = length > SOURCE_CHAR_WARNING_THRESHOLD

  return (
    <section className={styles.pane} aria-label="原文">
      <div className={styles.paneHeader}>
        <span className={styles.metaLabel}>SOURCE</span>
        <button
          type="button"
          className={styles.paneAction}
          onClick={onClear}
          disabled={length === 0}
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
        {isOverLimit ? (
          <span className={styles.charCount} data-over-limit="true">
            原文が {SOURCE_CHAR_LIMIT.toLocaleString()} 文字を{' '}
            {(length - SOURCE_CHAR_LIMIT).toLocaleString()} 文字超過しています（
            {(length - SOURCE_CHAR_LIMIT).toLocaleString()}{' '}
            文字減らす必要があります）
          </span>
        ) : (
          <span
            className={styles.charCount}
            data-near-limit={isNearLimit || undefined}
          >
            {length.toLocaleString()}/{SOURCE_CHAR_LIMIT.toLocaleString()}
          </span>
        )}
      </div>
    </section>
  )
})
