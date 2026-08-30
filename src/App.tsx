import { useEffect, useRef, useState } from 'react'
import { createSession } from './translation'
import type { Session, SessionSnapshot } from './translation'
import { INPUT_LIMIT, INPUT_WARN_AT } from './translation'
import { Workspace } from './ui'
import type { TranslationStatus as UiTranslationStatus } from './ui'

const INITIAL_SNAPSHOT: SessionSnapshot = {
  source: '',
  translation: '',
  translationIsCurrent: true,
  sourceLanguage: 'unspecified',
  targetLanguage: 'english',
  idiomatic: false,
  tone: 'standard',
  translationStatus: 'idle',
  connectionStatus: 'checking',
  sourceLength: 0,
  overLimit: false,
  profiles: [],
  selectedProfileId: '',
}

function mapTranslationStatus(snapshot: SessionSnapshot): UiTranslationStatus {
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
    case 'auth-failed':
      return 'authError'
    case 'translation-failed':
      return 'translationError'
  }
}

function toWorkspaceView(snapshot: SessionSnapshot) {
  const translationStatus = mapTranslationStatus(snapshot)
  const translatedText = snapshot.translationIsCurrent
    ? snapshot.translation
    : ''
  const previousTranslatedText = snapshot.translationIsCurrent
    ? undefined
    : snapshot.translation

  return {
    connectionStatus: snapshot.connectionStatus,
    profiles: snapshot.profiles,
    selectedProfileId: snapshot.selectedProfileId,
    sourceText: snapshot.source,
    sourceLength: snapshot.sourceLength,
    overLimit: snapshot.overLimit,
    inputLimit: INPUT_LIMIT,
    inputWarnAt: INPUT_WARN_AT,
    sourceLanguage: snapshot.sourceLanguage,
    targetLanguage: snapshot.targetLanguage,
    idiomatic: snapshot.idiomatic,
    tone: snapshot.tone,
    translationStatus,
    translatedText,
    previousTranslatedText,
  }
}

export default function App() {
  const sessionRef = useRef<Session | null>(null)
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(INITIAL_SNAPSHOT)

  useEffect(() => {
    const session = createSession()
    sessionRef.current = session
    setSnapshot(session.getSnapshot())
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
      onProfileSelect={(id) => sessionRef.current?.selectProfile(id)}
      onProfileAdd={(draft) => sessionRef.current?.addProfile(draft)}
      onProfileUpdate={(id, draft) =>
        sessionRef.current?.updateProfile(id, draft)
      }
      onProfileDelete={(id) => sessionRef.current?.deleteProfile(id)}
      onSourceTextChange={(text) => sessionRef.current?.setSource(text)}
      onClear={() => sessionRef.current?.clear()}
      onSourceLanguageChange={(language) =>
        sessionRef.current?.setSourceLanguage(language)
      }
      onTargetLanguageChange={(language) =>
        sessionRef.current?.setTargetLanguage(language)
      }
      onIdiomaticChange={(idiomatic) =>
        sessionRef.current?.setIdiomatic(idiomatic)
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
        session.retry()
      }}
    />
  )
}
