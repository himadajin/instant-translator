import { useEffect, useRef, useState } from 'react'
import type { TranslationStatus } from './types'
import styles from '../styles/Pane.module.css'

const COPIED_LABEL_DURATION_MS = 1500

// Announces only translation start/completion milestones (not each streamed
// token). `pending` and `streaming` share the same text so entering
// `streaming` does not trigger a second "started" announcement.
const STATUS_ANNOUNCEMENT: Partial<Record<TranslationStatus, string>> = {
  pending: '翻訳を開始しました',
  streaming: '翻訳を開始しました',
  done: '翻訳が完了しました',
  connectionError: 'ローカル翻訳に接続できません',
  translationError: '翻訳を完了できませんでした',
  overLimit: '原文が上限を超えています',
}

export function TranslationPane({
  translationStatus,
  translatedText,
  previousTranslatedText,
  inputLimit,
  onCopy,
  onRetry,
}: {
  translationStatus: TranslationStatus
  translatedText: string
  previousTranslatedText?: string
  inputLimit: number
  onCopy: () => void | Promise<void>
  onRetry: () => void
}) {
  const [isCopied, setIsCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => {
    return () => clearTimeout(copyTimeoutRef.current)
  }, [])

  const canCopy = translationStatus === 'done' && translatedText.length > 0

  const handleCopy = async () => {
    try {
      await onCopy()
    } catch {
      return
    }
    setIsCopied(true)
    clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(
      () => setIsCopied(false),
      COPIED_LABEL_DURATION_MS,
    )
  }

  return (
    <section className={styles.pane} aria-label="訳文">
      <div className={styles.paneHeader}>
        <span className={styles.metaLabel}>TRANSLATION</span>
        <button
          type="button"
          className={styles.paneAction}
          onClick={handleCopy}
          disabled={!canCopy}
        >
          {isCopied ? 'COPIED' : 'COPY'}
        </button>
      </div>

      <div className={styles.translationBody}>
        {renderBody({
          translationStatus,
          translatedText,
          previousTranslatedText,
          inputLimit,
          onRetry,
        })}
      </div>

      <span className={styles.visuallyHidden} role="status" aria-live="polite">
        {STATUS_ANNOUNCEMENT[translationStatus] ?? ''}
      </span>
    </section>
  )
}

function renderBody({
  translationStatus,
  translatedText,
  previousTranslatedText,
  inputLimit,
  onRetry,
}: {
  translationStatus: TranslationStatus
  translatedText: string
  previousTranslatedText?: string
  inputLimit: number
  onRetry: () => void
}) {
  switch (translationStatus) {
    case 'idle':
      return <p className={styles.placeholder}>翻訳結果</p>
    case 'pending':
      return previousTranslatedText ? (
        <p className={styles.translationText} data-dimmed="true">
          {previousTranslatedText}
        </p>
      ) : (
        <p className={styles.placeholder}>翻訳結果</p>
      )
    case 'streaming':
    case 'done':
      return <p className={styles.translationText}>{translatedText}</p>
    case 'connectionError':
      return (
        <div className={styles.errorState}>
          <p className={styles.errorText}>ローカル翻訳に接続できません</p>
          <button type="button" className={styles.retry} onClick={onRetry}>
            再試行
          </button>
        </div>
      )
    case 'translationError':
      return (
        <div className={styles.errorState}>
          <p className={styles.errorText}>翻訳を完了できませんでした</p>
          <button type="button" className={styles.retry} onClick={onRetry}>
            再試行
          </button>
        </div>
      )
    case 'overLimit':
      return (
        <div className={styles.errorState}>
          <p className={styles.errorText}>
            原文が {inputLimit.toLocaleString()} 文字を超えています
          </p>
        </div>
      )
  }
}
