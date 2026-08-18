import styles from '../styles/LanguageRail.module.css'

export function LanguageRail({ isActive }: { isActive: boolean }) {
  return (
    <div
      className={styles.rail}
      data-active={isActive || undefined}
      aria-hidden="true"
    >
      {isActive && <span className={styles.dot} />}
    </div>
  )
}
