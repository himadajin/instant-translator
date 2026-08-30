import { DEBOUNCE_MS, INPUT_LIMIT } from './constants'
import { detectLanguage } from './detection'
import {
  AuthError,
  ConnectionError,
  createInference,
  isAbortError,
  type Inference,
} from './inference'
import { createPersistence } from './persistence'
import {
  createDefaultProfileState,
  createProfileId,
  normalizeBaseUrl,
  type Profile,
  type ProfileDraft,
} from './profiles'
import { buildMessages } from './prompts'
import { countGraphemes } from './graphemes'
import type {
  KeyValueStorage,
  Language,
  SessionSnapshot,
  SourceLanguage,
  Tone,
  TranslationDirection,
  WorkState,
  WorkspaceState,
} from './types'
import { createWorkspace, toSnapshot } from './workspace'

export type SessionDeps = {
  fetch?: typeof fetch
  storage?: KeyValueStorage
  inference?: Inference
}

export type Session = {
  getSnapshot(): SessionSnapshot
  subscribe(listener: (snapshot: SessionSnapshot) => void): () => void
  setSource(source: string): void
  setSourceLanguage(language: SourceLanguage): void
  setTargetLanguage(language: Language): void
  setIdiomatic(idiomatic: boolean): void
  setTone(tone: Tone): void
  selectProfile(id: string): void
  addProfile(draft: ProfileDraft): void
  updateProfile(id: string, draft: ProfileDraft): void
  deleteProfile(id: string): void
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
  const loadedProfiles = persistence.loadProfiles()
  let profileState = loadedProfiles ?? createDefaultProfileState()

  const listeners = new Set<(snapshot: SessionSnapshot) => void>()
  let cachedSnapshot = snapshotFrom()
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let requestId = 0
  let healthAbort: AbortController | undefined
  let healthGeneration = 0
  let translateAbort: AbortController | undefined
  let disposed = false

  function snapshotFrom(): SessionSnapshot {
    return {
      ...toSnapshot(workspace.read()),
      profiles: profileState.profiles,
      selectedProfileId: profileState.selectedId,
    }
  }

  function getSnapshot(): SessionSnapshot {
    return cachedSnapshot
  }

  function emit(): void {
    cachedSnapshot = snapshotFrom()
    for (const listener of listeners) {
      listener(cachedSnapshot)
    }
  }

  function persist(): void {
    persistence.save(workStateFrom(workspace.read()))
  }

  function selectedProfile(): Profile {
    return (
      profileState.profiles.find(
        (profile) => profile.id === profileState.selectedId,
      ) ?? profileState.profiles[0]
    )
  }

  function persistProfiles(): void {
    persistence.saveProfiles(profileState)
  }

  function scheduleTranslate(): void {
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
      debounceTimer = undefined
    }

    abortTranslation()

    const state = workspace.read()
    if (state.source === '' || countGraphemes(state.source) > INPUT_LIMIT) {
      return
    }

    const resolution = resolveDirection(state)
    if (resolution.direction === null) {
      workspace.write({
        translationStatus: 'language-conflict',
        translationIsCurrent: false,
      })
      emit()
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
    if (
      disposed ||
      state.source === '' ||
      countGraphemes(state.source) > INPUT_LIMIT
    ) {
      return
    }

    invalidateHealthCheck()

    const resolution = resolveDirection(state)
    if (resolution.direction === null) {
      workspace.write({
        translationStatus: 'language-conflict',
        translationIsCurrent: false,
      })
      emit()
      return
    }
    const direction = resolution.direction
    workspace.write({
      translationStatus: 'translating',
      translationIsCurrent: false,
    })
    persist()
    emit()

    const id = ++requestId
    translateAbort?.abort()
    translateAbort = new AbortController()
    const current = workspace.read()
    const messages = buildMessages({
      source: current.source,
      direction,
      idiomatic: current.idiomatic,
      tone: current.tone,
    })

    try {
      let gotChunk = false
      for await (const chunk of inference.translate(
        selectedProfile(),
        messages,
        translateAbort.signal,
      )) {
        if (id !== requestId) {
          return
        }
        if (chunk.length === 0) {
          continue
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
      if (!gotChunk) {
        workspace.write({
          translationStatus: 'translation-failed',
          translationIsCurrent: false,
        })
        persist()
        emit()
        return
      }

      const completed = workspace.read()
      workspace.write({
        translationStatus: 'complete',
        completedTranslation: completed.translation,
        completedSource: completed.source,
        completedDirection: direction,
        completedIdiomatic: completed.idiomatic,
        completedTone: completed.tone,
        connectionStatus: 'ready',
      })
      persist()
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
      } else if (error instanceof AuthError) {
        workspace.write({
          connectionStatus: 'auth-failed',
          translationStatus: 'auth-failed',
        })
      } else {
        workspace.write({ translationStatus: 'translation-failed' })
      }
      persist()
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
        completedSource: '',
        completedDirection: null,
        completedIdiomatic: null,
        completedTone: null,
        translationIsCurrent: true,
        translationStatus: 'idle',
      })
      persist()
      emit()
      return
    }

    if (countGraphemes(source) > INPUT_LIMIT) {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer)
        debounceTimer = undefined
      }
      abortTranslation()
      workspace.write({
        translationIsCurrent: false,
        translationStatus: 'idle',
      })
      persist()
      emit()
      return
    }

    persist()
    scheduleTranslate()
  }

  function setSourceLanguage(language: SourceLanguage): void {
    const state = workspace.read()
    if (language !== 'auto' && language === state.targetLanguage) {
      return
    }
    workspace.write({ sourceLanguage: language })
    persist()
    emit()
    scheduleTranslate()
  }

  function setTargetLanguage(language: Language): void {
    const state = workspace.read()
    if (state.sourceLanguage !== 'auto' && state.sourceLanguage === language) {
      return
    }
    workspace.write({ targetLanguage: language })
    persist()
    emit()
    scheduleTranslate()
  }

  function setIdiomatic(idiomatic: boolean): void {
    workspace.write({ idiomatic })
    persist()
    emit()
    scheduleTranslate()
  }

  function setTone(tone: Tone): void {
    workspace.write({ tone })
    persist()
    emit()
    scheduleTranslate()
  }

  function selectProfile(id: string): void {
    if (
      id === profileState.selectedId ||
      !profileState.profiles.some((profile) => profile.id === id)
    ) {
      return
    }
    profileState = { ...profileState, selectedId: id }
    persistProfiles()
    emit()
    void checkConnection()
    scheduleTranslate()
  }

  function addProfile(draft: ProfileDraft): void {
    const profile = normalizedProfile(createProfileId(), draft)
    profileState = {
      ...profileState,
      profiles: [...profileState.profiles, profile],
    }
    persistProfiles()
    emit()
  }

  function updateProfile(id: string, draft: ProfileDraft): void {
    if (!profileState.profiles.some((profile) => profile.id === id)) {
      return
    }
    profileState = {
      ...profileState,
      profiles: profileState.profiles.map((profile) =>
        profile.id === id ? normalizedProfile(id, draft) : profile,
      ),
    }
    persistProfiles()
    emit()
    if (id === profileState.selectedId) {
      void checkConnection()
      scheduleTranslate()
    }
  }

  function deleteProfile(id: string): void {
    if (
      profileState.profiles.length === 1 ||
      !profileState.profiles.some((profile) => profile.id === id)
    ) {
      return
    }
    const profiles = profileState.profiles.filter(
      (profile) => profile.id !== id,
    )
    const deletedSelected = id === profileState.selectedId
    profileState = {
      profiles,
      selectedId: deletedSelected ? profiles[0].id : profileState.selectedId,
    }
    persistProfiles()
    emit()
    if (deletedSelected) {
      void checkConnection()
      scheduleTranslate()
    }
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
      completedSource: '',
      completedDirection: null,
      completedIdiomatic: null,
      completedTone: null,
      translationIsCurrent: true,
      translationStatus: 'idle',
    })
    persist()
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
    if (disposed) {
      return
    }

    const generation = ++healthGeneration
    healthAbort?.abort()
    const controller = new AbortController()
    healthAbort = controller
    workspace.write({ connectionStatus: 'checking' })
    emit()
    try {
      const status = await inference.checkHealth(
        selectedProfile(),
        controller.signal,
      )
      if (disposed || generation !== healthGeneration) {
        return
      }
      workspace.write({ connectionStatus: status })
      emit()
    } catch (error) {
      if (disposed || generation !== healthGeneration || isAbortError(error)) {
        return
      }
      workspace.write({ connectionStatus: 'unavailable' })
      emit()
    } finally {
      if (generation === healthGeneration) {
        healthAbort = undefined
      }
    }
  }

  function invalidateHealthCheck(): void {
    healthGeneration += 1
    healthAbort?.abort()
    healthAbort = undefined
  }

  function dispose(): void {
    disposed = true
    listeners.clear()
    if (debounceTimer !== undefined) {
      clearTimeout(debounceTimer)
    }
    invalidateHealthCheck()
    abortTranslation()
  }

  if (loadedProfiles === null) {
    persistProfiles()
  }
  void checkConnection()
  if (workspace.read().translationStatus === 'waiting') {
    scheduleTranslate()
  }

  return {
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setSource,
    setSourceLanguage,
    setTargetLanguage,
    setIdiomatic,
    setTone,
    selectProfile,
    addProfile,
    updateProfile,
    deleteProfile,
    clear,
    retry,
    checkConnection,
    dispose,
  }
}

function normalizedProfile(id: string, draft: ProfileDraft): Profile {
  return {
    id,
    name: draft.name.trim(),
    baseUrl: normalizeBaseUrl(draft.baseUrl),
    apiKey: draft.apiKey.trim(),
    model: draft.model.trim(),
    parameters: draft.parameters,
  }
}

function restoredState(loaded: WorkState | null): Partial<WorkspaceState> {
  if (loaded === null) {
    return {}
  }

  const resolution = resolveDirection(loaded)
  const direction = resolution.direction
  const hasCompletedTranslation = loaded.completedTranslation !== ''
  const hasMatchingProvenance =
    hasCompletedTranslation &&
    loaded.completedSource === loaded.source &&
    direction !== null &&
    loaded.completedDirection === direction &&
    loaded.completedIdiomatic === loaded.idiomatic &&
    loaded.completedTone === loaded.tone

  if (loaded.source === '') {
    return {
      ...loaded,
      translation: '',
      translationIsCurrent: true,
      translationStatus: 'idle',
    }
  }

  if (hasMatchingProvenance) {
    return {
      ...loaded,
      translation: loaded.completedTranslation,
      translationIsCurrent: true,
      translationStatus: 'complete',
    }
  }

  return {
    ...loaded,
    translation: loaded.completedTranslation,
    translationIsCurrent: false,
    translationStatus:
      countGraphemes(loaded.source) > INPUT_LIMIT
        ? 'idle'
        : direction === null
          ? 'language-conflict'
          : 'waiting',
  }
}

function workStateFrom(state: WorkspaceState): WorkState {
  return {
    source: state.source,
    completedTranslation: state.completedTranslation,
    completedSource: state.completedSource,
    completedDirection: state.completedDirection,
    completedIdiomatic: state.completedIdiomatic,
    completedTone: state.completedTone,
    sourceLanguage: state.sourceLanguage,
    targetLanguage: state.targetLanguage,
    idiomatic: state.idiomatic,
    tone: state.tone,
  }
}

function resolveDirection(state: {
  source: string
  sourceLanguage: SourceLanguage
  targetLanguage: Language
}): { direction: TranslationDirection | null } {
  const sourceLanguage =
    state.sourceLanguage === 'auto'
      ? detectLanguage(state.source)
      : state.sourceLanguage

  if (sourceLanguage === state.targetLanguage) {
    return { direction: null }
  }
  if (sourceLanguage === 'japanese') {
    return { direction: 'ja-to-en' }
  }
  if (sourceLanguage === 'english') {
    return { direction: 'en-to-ja' }
  }

  // With the currently supported pair, an ambiguous automatic detection can
  // safely fall back to the only source language different from the target.
  return {
    direction: state.targetLanguage === 'english' ? 'ja-to-en' : 'en-to-ja',
  }
}
