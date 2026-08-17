import { DEBOUNCE_MS, INPUT_LIMIT } from './constants'
import { detectLanguage } from './detection'
import {
  ConnectionError,
  createInference,
  isAbortError,
  type Inference,
} from './inference'
import { createPersistence } from './persistence'
import { buildMessages } from './prompts'
import type {
  DirectionControl,
  KeyValueStorage,
  Tone,
  TranslationDirection,
  TranslationMethod,
  WorkState,
  WorkspaceSnapshot,
  WorkspaceState,
} from './types'
import { createWorkspace, toSnapshot } from './workspace'

export type SessionDeps = {
  fetch?: typeof fetch
  storage?: KeyValueStorage
  inference?: Inference
}

export type Session = {
  getSnapshot(): WorkspaceSnapshot
  subscribe(listener: (snapshot: WorkspaceSnapshot) => void): () => void
  setSource(source: string): void
  swapDirection(): void
  unlockDirection(): void
  setMethod(method: TranslationMethod): void
  setTone(tone: Tone): void
  clear(): void
  retry(): void
  checkConnection(): Promise<void>
  dispose(): void
}

export function createSession(deps: SessionDeps = {}): Session {
  const storage = deps.storage ?? localStorage
  const persistence = createPersistence(storage)
  const inference = deps.inference ?? createInference(deps.fetch ?? fetch)
  const workspace = createWorkspace(restoredState(persistence.load()))

  const listeners = new Set<(snapshot: WorkspaceSnapshot) => void>()
  let cachedSnapshot = toSnapshot(workspace.read())
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let requestId = 0
  let healthAbort: AbortController | undefined
  let translateAbort: AbortController | undefined
  let disposed = false

  function getSnapshot(): WorkspaceSnapshot {
    return cachedSnapshot
  }

  function emit(): void {
    cachedSnapshot = toSnapshot(workspace.read())
    for (const listener of listeners) {
      listener(cachedSnapshot)
    }
  }

  function persist(complete: boolean): void {
    const state = workspace.read()
    const completedTranslation = complete
      ? state.translation
      : state.completedTranslation
    if (complete) {
      workspace.write({ completedTranslation })
    }
    persistence.save(workStateFrom(workspace.read()))
  }

  function applyDirectionFromSource(): void {
    const state = workspace.read()
    if (state.directionControl === 'fixed' || state.source === '') {
      return
    }
    workspace.write({ direction: resolveDirection(state) })
  }

  function scheduleTranslate(): void {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }

    abortTranslation()

    const state = workspace.read()
    if (state.source === '' || state.source.length > INPUT_LIMIT) {
      return
    }

    workspace.write({
      translationStatus: 'waiting',
      translationIsCurrent: false,
    })
    emit()

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void startTranslate()
    }, DEBOUNCE_MS)
  }

  function abortTranslation(): void {
    requestId += 1
    translateAbort?.abort()
    translateAbort = undefined
  }

  async function startTranslate(): Promise<void> {
    const state = workspace.read()
    if (state.source === '' || state.source.length > INPUT_LIMIT) {
      return
    }

    const direction = resolveDirection(state)
    workspace.write({
      direction,
      translationStatus: 'translating',
      translationIsCurrent: false,
    })
    persist(false)
    emit()

    const id = ++requestId
    translateAbort?.abort()
    translateAbort = new AbortController()
    const current = workspace.read()
    const messages = buildMessages({
      source: current.source,
      direction,
      method: current.method,
      tone: current.tone,
    })

    try {
      let gotChunk = false
      for await (const chunk of inference.translate(
        messages,
        translateAbort.signal,
      )) {
        if (id !== requestId) {
          return
        }
        if (!gotChunk) {
          gotChunk = true
          workspace.write({
            translation: chunk,
            translationIsCurrent: true,
          })
        } else {
          workspace.write({
            translation: workspace.read().translation + chunk,
          })
        }
        emit()
      }
      if (id !== requestId) {
        return
      }
      workspace.write({
        translationStatus: 'complete',
        completedTranslation: workspace.read().translation,
        connectionStatus: 'ready',
      })
      persist(true)
      emit()
    } catch (error) {
      if (id !== requestId || isAbortError(error)) {
        return
      }
      if (error instanceof ConnectionError) {
        workspace.write({
          connectionStatus: 'unavailable',
          translationStatus: 'connection-failed',
        })
      } else {
        workspace.write({ translationStatus: 'translation-failed' })
      }
      persist(false)
      emit()
    }
  }

  function setSource(source: string): void {
    workspace.write({ source })
    if (source === '') {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer)
        debounceTimer = undefined
      }
      abortTranslation()
      workspace.write({
        translation: '',
        completedTranslation: '',
        translationIsCurrent: true,
        translationStatus: 'idle',
      })
      persist(true)
      emit()
      return
    }

    applyDirectionFromSource()

    if (source.length > INPUT_LIMIT) {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer)
        debounceTimer = undefined
      }
      abortTranslation()
      workspace.write({
        translationIsCurrent: false,
        translationStatus: 'idle',
      })
      persist(false)
      emit()
      return
    }

    persist(false)
    scheduleTranslate()
  }

  function swapDirection(): void {
    const next: TranslationDirection =
      workspace.read().direction === 'ja-to-en' ? 'en-to-ja' : 'ja-to-en'
    workspace.write({
      direction: next,
      directionControl: 'fixed',
    })
    persist(false)
    emit()
    scheduleTranslate()
  }

  function unlockDirection(): void {
    workspace.write({ directionControl: 'auto' })
    applyDirectionFromSource()
    persist(false)
    emit()
    scheduleTranslate()
  }

  function setMethod(method: TranslationMethod): void {
    workspace.write({ method })
    persist(false)
    emit()
    scheduleTranslate()
  }

  function setTone(tone: Tone): void {
    workspace.write({ tone })
    persist(false)
    emit()
    scheduleTranslate()
  }

  function clear(): void {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }
    abortTranslation()
    workspace.write({
      source: '',
      translation: '',
      completedTranslation: '',
      translationIsCurrent: true,
      translationStatus: 'idle',
    })
    persist(true)
    emit()
  }

  function retry(): void {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }
    void startTranslate()
  }

  async function checkConnection(): Promise<void> {
    healthAbort?.abort()
    healthAbort = new AbortController()
    workspace.write({ connectionStatus: 'checking' })
    emit()
    try {
      const status = await inference.checkHealth(healthAbort.signal)
      if (disposed) {
        return
      }
      workspace.write({ connectionStatus: status })
      emit()
    } catch (error) {
      if (disposed || isAbortError(error)) {
        return
      }
      workspace.write({ connectionStatus: 'unavailable' })
      emit()
    }
  }

  function dispose(): void {
    disposed = true
    listeners.clear()
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
    }
    healthAbort?.abort()
    abortTranslation()
  }

  void checkConnection()

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSource,
    swapDirection,
    unlockDirection,
    setMethod,
    setTone,
    clear,
    retry,
    checkConnection,
    dispose,
  }
}

function restoredState(loaded: WorkState | null): Partial<WorkspaceState> {
  if (loaded === null) {
    return {}
  }
  return {
    ...loaded,
    translation: loaded.completedTranslation,
    translationIsCurrent: true,
    translationStatus:
      loaded.source === ''
        ? 'idle'
        : loaded.completedTranslation === ''
          ? 'idle'
          : 'complete',
  }
}

function workStateFrom(state: WorkspaceState): WorkState {
  return {
    source: state.source,
    completedTranslation: state.completedTranslation,
    direction: state.direction,
    directionControl: state.directionControl,
    method: state.method,
    tone: state.tone,
  }
}

function resolveDirection(state: {
  source: string
  direction: TranslationDirection
  directionControl: DirectionControl
}): TranslationDirection {
  if (state.directionControl === 'fixed') {
    return state.direction
  }
  const detected = detectLanguage(state.source)
  if (detected === 'japanese') {
    return 'ja-to-en'
  }
  if (detected === 'english') {
    return 'en-to-ja'
  }
  return state.direction
}
