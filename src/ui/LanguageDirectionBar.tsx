import type { TranslationDirection } from './types'
import styles from '../styles/LanguageDirectionBar.module.css'

const LANGUAGE_NAMES: Record<
  TranslationDirection,
  { source: string; target: string }
> = {
  jaToEn: { source: '日本語', target: 'ENGLISH' },
  enToJa: { source: 'ENGLISH', target: '日本語' },
}

export function LanguageDirectionBar({
  direction,
  isDirectionFixed,
  onSwapDirection,
  onReleaseFixedDirection,
}: {
  direction: TranslationDirection
  isDirectionFixed: boolean
  onSwapDirection: () => void
  onReleaseFixedDirection: () => void
}) {
  const { source, target } = LANGUAGE_NAMES[direction]

  return (
    <div className={styles.bar}>
      {isDirectionFixed ? (
        <button
          type="button"
          className={styles.modeLabel}
          onClick={onReleaseFixedDirection}
          aria-label="FIXED: 押すと自動検出へ戻る"
        >
          FIXED
        </button>
      ) : (
        <span className={styles.modeLabel}>AUTO</span>
      )}
      <div className={styles.languages}>
        <span className={styles.language}>{source}</span>
        <button
          type="button"
          className={styles.swap}
          onClick={onSwapDirection}
          aria-label="翻訳方向を入れ替えて固定する"
        >
          ⇄
        </button>
        <span className={styles.language}>{target}</span>
      </div>
    </div>
  )
}
