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

// Parameters edited as dedicated form fields; the extra-parameters JSON may
// not set them so each key has exactly one place to be specified.
export const SAMPLING_FIELD_KEYS = [
  'temperature',
  'top_p',
  'top_k',
  'repeat_penalty',
] as const

export type SamplingFieldKey = (typeof SAMPLING_FIELD_KEYS)[number]

export type SamplingFields = Partial<Record<SamplingFieldKey, number>>

export function splitParameters(parameters: Record<string, unknown>): {
  fields: SamplingFields
  extra: Record<string, unknown>
} {
  const fields: SamplingFields = {}
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(parameters)) {
    if (isSamplingFieldKey(key) && typeof value === 'number') {
      fields[key] = value
    } else {
      extra[key] = value
    }
  }
  return { fields, extra }
}

export function mergeParameters(
  fields: SamplingFields,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...extra }
  for (const key of SAMPLING_FIELD_KEYS) {
    const value = fields[key]
    if (value !== undefined) {
      merged[key] = value
    }
  }
  return merged
}

function isSamplingFieldKey(key: string): key is SamplingFieldKey {
  return (SAMPLING_FIELD_KEYS as readonly string[]).includes(key)
}

export type SamplingFieldParseResult =
  | { ok: true; value: number | undefined }
  | { ok: false; reason: 'not-number' | 'not-integer' }

// An empty field means "do not send this parameter": the inference target's
// own default applies.
export function parseSamplingFieldText(
  key: SamplingFieldKey,
  text: string,
): SamplingFieldParseResult {
  const trimmed = text.trim()
  if (trimmed === '') {
    return { ok: true, value: undefined }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    return { ok: false, reason: 'not-number' }
  }
  if (key === 'top_k' && !Number.isInteger(value)) {
    return { ok: false, reason: 'not-integer' }
  }
  return { ok: true, value }
}

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
  | { ok: false; reason: 'reserved-key' | 'field-key'; key: string }

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
  for (const key of SAMPLING_FIELD_KEYS) {
    if (key in value) {
      return { ok: false, reason: 'field-key', key }
    }
  }
  return { ok: true, value }
}
