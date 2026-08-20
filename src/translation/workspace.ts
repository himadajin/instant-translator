import { INPUT_LIMIT } from './constants'
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
  direction: 'ja-to-en',
  directionControl: 'auto',
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
    direction: state.direction,
    directionControl: state.directionControl,
    idiomatic: state.idiomatic,
    tone: state.tone,
    translationStatus: state.translationStatus,
    connectionStatus: state.connectionStatus,
    sourceLength,
    overLimit: sourceLength > INPUT_LIMIT,
  }
}
