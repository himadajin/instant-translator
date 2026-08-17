import { INPUT_LIMIT } from './constants'
import type { WorkspaceSnapshot, WorkspaceState } from './types'

export const defaultWorkspaceState: WorkspaceState = {
  source: '',
  translation: '',
  completedTranslation: '',
  translationIsCurrent: true,
  direction: 'ja-to-en',
  directionControl: 'auto',
  method: 'standard',
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
  return {
    source: state.source,
    translation: state.translation,
    translationIsCurrent: state.translationIsCurrent,
    direction: state.direction,
    directionControl: state.directionControl,
    method: state.method,
    tone: state.tone,
    translationStatus: state.translationStatus,
    connectionStatus: state.connectionStatus,
    sourceLength: state.source.length,
    overLimit: state.source.length > INPUT_LIMIT,
  }
}
