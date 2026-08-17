export const DEBOUNCE_MS = 400

export const INPUT_LIMIT = 4000

export const INPUT_WARN_AT = 3200

export const INFERENCE_BASE_URL = 'http://127.0.0.1:8080'

export const HEALTH_URL = `${INFERENCE_BASE_URL}/health`

export const CHAT_COMPLETIONS_URL = `${INFERENCE_BASE_URL}/v1/chat/completions`

export const STORAGE_KEY = 'instant-translator.work-state'

// LFM2.5-1.2B-JP-202606 model card (Hugging Face): temperature 0.1, top_k 50, repetition_penalty 1.05.
// llama.cpp's OpenAI-compatible body uses repeat_penalty for that last value.
export const SAMPLING = {
  temperature: 0.1,
  top_k: 50,
  repeat_penalty: 1.05,
} as const
