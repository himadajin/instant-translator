import { INPUT_LIMIT } from './constants'
import { detectLanguage } from './detection'
import { countGraphemes } from './graphemes'
import type { WorkspaceSnapshot, WorkspaceState } from './types'

export const defaultWorkspaceState: WorkspaceState = {
  source: '',
  translation: '',
  completedTranslation: '',
  completedSource: '',
  completedDirection: null,
  completedIdiomatic: null,
  completedTone: null,
  translationIsCurrent: true,
  sourceLanguage: 'auto',
  targetLanguage: 'english',
  idiomatic: false,
  tone: 'standard',
  translationStatus: 'idle',
  connectionStatus: 'checking',
}

export function createWorkspace(initial?: Partial<WorkspaceState>) {
  let state: WorkspaceState = { ...defaultWorkspaceState, ...initial }

  return {
    read(): WorkspaceState {
      return state
    },
    write(patch: Partial<WorkspaceState>): WorkspaceState {
      state = { ...state, ...patch }
      return state
    },
  }
}

export function toSnapshot(state: WorkspaceState): WorkspaceSnapshot {
  const sourceLength = countGraphemes(state.source)

  return {
    source: state.source,
    translation: state.translation,
    translationIsCurrent: state.translationIsCurrent,
    sourceLanguage: state.sourceLanguage,
    targetLanguage: state.targetLanguage,
    detectedLanguage: detectLanguage(state.source),
    idiomatic: state.idiomatic,
    tone: state.tone,
    translationStatus: state.translationStatus,
    connectionStatus: state.connectionStatus,
    sourceLength,
    overLimit: sourceLength > INPUT_LIMIT,
  }
}
