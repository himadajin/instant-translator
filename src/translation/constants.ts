export const DEBOUNCE_MS = 400

export const INPUT_LIMIT = 4000

export const INPUT_WARN_AT = 3200

const DEFAULT_PORT = 8080

export function parseInferencePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT
  }

  const trimmed = value.trim()
  if (trimmed === '' || !/^[0-9]+$/.test(trimmed)) {
    throw invalidInferencePort(value)
  }

  const port = Number(trimmed)
  if (port < 1 || port > 65535) {
    throw invalidInferencePort(value)
  }

  return port
}

function invalidInferencePort(value: string): Error {
  return new Error(
    `VITE_INFERENCE_PORT must be an integer from 1 to 65535, got ${JSON.stringify(value)}`,
  )
}

const inferencePort = parseInferencePort(import.meta.env.VITE_INFERENCE_PORT)

export const INFERENCE_BASE_URL = `http://127.0.0.1:${inferencePort}`

export const HEALTH_URL = `${INFERENCE_BASE_URL}/health`

export const CHAT_COMPLETIONS_URL = `${INFERENCE_BASE_URL}/v1/chat/completions`

export const STORAGE_KEY = 'instant-translator.work-state'

// Hy-MT2 model card (Hugging Face): temperature 0.7, top_p 0.6, top_k 20, repetition_penalty 1.05.
// llama.cpp's OpenAI-compatible body uses repeat_penalty for that last value.
export const SAMPLING = {
  temperature: 0.7,
  top_p: 0.6,
  top_k: 20,
  repeat_penalty: 1.05,
} as const
