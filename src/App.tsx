import { useEffect, useRef, useState } from 'react'
import { createSession } from './translation'
import type {
  Session,
  TranslationDirection as SessionDirection,
  TranslationMethod,
  WorkspaceSnapshot,
} from './translation'
import { Workspace } from './ui'
import type {
  TranslationDirection as UiDirection,
  TranslationMode,
  TranslationStatus as UiTranslationStatus,
} from './ui'

const INITIAL_SNAPSHOT: WorkspaceSnapshot = {
  source: '',
  translation: '',
  translationIsCurrent: true,
  direction: 'ja-to-en',
  directionControl: 'auto',
  method: 'standard',
  tone: 'standard',
  translationStatus: 'idle',
  connectionStatus: 'checking',
  sourceLength: 0,
  overLimit: false,
}

function mapDirection(direction: SessionDirection): UiDirection {
  return direction === 'ja-to-en' ? 'jaToEn' : 'enToJa'
}

function mapMethod(method: TranslationMethod): TranslationMode {
  return method === 'idiomatic' ? 'paraphrase' : 'standard'
}

function toSessionMethod(mode: TranslationMode): TranslationMethod {
  return mode === 'paraphrase' ? 'idiomatic' : 'standard'
}

function mapTranslationStatus(
  snapshot: WorkspaceSnapshot,
): UiTranslationStatus {
  if (snapshot.overLimit) {
    return 'overLimit'
  }

  switch (snapshot.translationStatus) {
    case 'idle':
      return 'idle'
    case 'waiting':
      return 'pending'
    case 'translating':
      // Keep the previous result dimmed until the first current chunk arrives.
      return snapshot.translationIsCurrent ? 'streaming' : 'pending'
    case 'complete':
      return 'done'
    case 'connection-failed':
      return 'connectionError'
    case 'translation-failed':
      return 'translationError'
  }
}

function toWorkspaceView(snapshot: WorkspaceSnapshot) {
  const translationStatus = mapTranslationStatus(snapshot)
  const translatedText = snapshot.translationIsCurrent
    ? snapshot.translation
    : ''
  const previousTranslatedText = snapshot.translationIsCurrent
    ? undefined
    : snapshot.translation

  return {
    connectionStatus: snapshot.connectionStatus,
    sourceText: snapshot.source,
    direction: mapDirection(snapshot.direction),
    isDirectionFixed: snapshot.directionControl === 'fixed',
    translationMode: mapMethod(snapshot.method),
    tone: snapshot.tone,
    translationStatus,
    translatedText,
    previousTranslatedText,
  }
}

export default function App() {
  const sessionRef = useRef<Session | null>(null)
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(INITIAL_SNAPSHOT)

  useEffect(() => {
    const session = createSession()
    sessionRef.current = session
    setSnapshot(session.getSnapshot())
    void session.checkConnection()
    const unsubscribe = session.subscribe(setSnapshot)
    return () => {
      unsubscribe()
      session.dispose()
      sessionRef.current = null
    }
  }, [])

  const view = toWorkspaceView(snapshot)

  return (
    <Workspace
      {...view}
      onSourceTextChange={(text) => sessionRef.current?.setSource(text)}
      onClear={() => sessionRef.current?.clear()}
      onSwapDirection={() => sessionRef.current?.swapDirection()}
      onReleaseFixedDirection={() => sessionRef.current?.unlockDirection()}
      onTranslationModeChange={(mode) =>
        sessionRef.current?.setMethod(toSessionMethod(mode))
      }
      onToneChange={(tone) => sessionRef.current?.setTone(tone)}
      onCopy={async () => {
        const current = sessionRef.current?.getSnapshot()
        if (!current || current.translationStatus !== 'complete') {
          return
        }
        await navigator.clipboard.writeText(current.translation)
      }}
      onRetry={() => {
        const session = sessionRef.current
        if (!session) {
          return
        }
        if (session.getSnapshot().translationStatus === 'connection-failed') {
          void session.checkConnection()
        }
        session.retry()
      }}
    />
  )
}
