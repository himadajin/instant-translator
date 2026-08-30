export type Profile = {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  parameters: Record<string, unknown>
}

export type ProfileDraft = Omit<Profile, 'id'>

export type ProfileState = {
  profiles: Profile[]
  selectedId: string
}

// Request-body keys the app itself owns; profile parameters may not set them.
export const RESERVED_PARAMETER_KEYS = ['messages', 'stream', 'model'] as const

export function createProfileId(): string {
  return crypto.randomUUID()
}

// Hy-MT2 model card (Hugging Face): temperature 0.7, top_p 0.6, top_k 20,
// repetition_penalty 1.05. llama.cpp's OpenAI-compatible body uses
// repeat_penalty for that last value.
export function createDefaultProfileState(): ProfileState {
  const profile: Profile = {
    id: createProfileId(),
    name: 'llama.cpp (ローカル)',
    baseUrl: 'http://127.0.0.1:8080/v1',
    apiKey: '',
    model: '',
    parameters: {
      temperature: 0.7,
      top_p: 0.6,
      top_k: 20,
      repeat_penalty: 1.05,
    },
  }
  return { profiles: [profile], selectedId: profile.id }
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

export type ProfileDraftErrors = {
  name?: 'required'
  baseUrl?: 'required' | 'invalid'
}

export function validateProfileDraft(draft: {
  name: string
  baseUrl: string
}): ProfileDraftErrors {
  const errors: ProfileDraftErrors = {}
  if (draft.name.trim() === '') {
    errors.name = 'required'
  }
  const baseUrl = normalizeBaseUrl(draft.baseUrl)
  if (baseUrl === '') {
    errors.baseUrl = 'required'
  } else if (!isHttpUrl(baseUrl)) {
    errors.baseUrl = 'invalid'
  }
  return errors
}

function isHttpUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === 'http:' || url.protocol === 'https:'
}

export type ParametersParseResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: 'invalid-json' | 'not-object' }
  | { ok: false; reason: 'reserved-key'; key: string }

export function parseParametersJson(text: string): ParametersParseResult {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { ok: true, value: {} }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'not-object' }
  }

  const value = parsed as Record<string, unknown>
  for (const key of RESERVED_PARAMETER_KEYS) {
    if (key in value) {
      return { ok: false, reason: 'reserved-key', key }
    }
  }
  return { ok: true, value }
}
