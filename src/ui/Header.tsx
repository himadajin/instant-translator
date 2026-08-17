import type { ConnectionStatus } from './types'
import styles from '../styles/Header.module.css'

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  ready: 'LOCAL READY',
  checking: 'LOCAL CHECKING',
  unavailable: 'LOCAL UNAVAILABLE',
}

export function Header({
  connectionStatus,
}: {
  connectionStatus: ConnectionStatus
}) {
  return (
    <header className={styles.header}>
      <span className={styles.appName}>Instant Translator</span>
      <span
        className={styles.status}
        data-status={connectionStatus}
        role="status"
        aria-live="polite"
      >
        {STATUS_LABEL[connectionStatus]}
      </span>
    </header>
  )
}
