import { CHAT_COMPLETIONS_URL, HEALTH_URL, SAMPLING } from './constants'
import type { ChatMessage, ConnectionStatus } from './types'

export class ConnectionError extends Error {
  readonly kind = 'connection' as const

  constructor(message = 'connection failed') {
    super(message)
    this.name = 'ConnectionError'
  }
}

export class TranslationError extends Error {
  readonly kind = 'translation' as const

  constructor(message = 'translation failed') {
    super(message)
    this.name = 'TranslationError'
  }
}

export type Inference = {
  checkHealth(signal?: AbortSignal): Promise<ConnectionStatus>
  translate(
    messages: ChatMessage[],
    signal: AbortSignal,
  ): AsyncGenerator<string>
}

export function createInference(fetchFn: typeof fetch = fetch): Inference {
  return {
    async checkHealth(signal) {
      try {
        const response = await fetchFn(HEALTH_URL, { method: 'GET', signal })
        if (!response.ok) {
          return 'unavailable'
        }
        const body: unknown = await response.json()
        if (
          typeof body === 'object' &&
          body !== null &&
          (body as { status?: unknown }).status === 'ok'
        ) {
          return 'ready'
        }
        return 'unavailable'
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }
        return 'unavailable'
      }
    },

    async *translate(messages, signal) {
      let response: Response
      try {
        response = await fetchFn(CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            stream: true,
            temperature: SAMPLING.temperature,
            top_p: SAMPLING.top_p,
            top_k: SAMPLING.top_k,
            repeat_penalty: SAMPLING.repeat_penalty,
          }),
          signal,
        })
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }
        throw new ConnectionError(
          error instanceof Error ? error.message : 'connection failed',
        )
      }

      if (!response.ok) {
        throw new TranslationError(`HTTP ${response.status}`)
      }
      if (!response.body) {
        throw new TranslationError('empty response body')
      }

      yield* readSseContent(response.body)
    },
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

async function* readSseContent(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>
      try {
        result = await reader.read()
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }
        throw new ConnectionError(
          error instanceof Error ? error.message : 'connection failed',
        )
      }

      const { done, value } = result
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const content = contentFromSseLine(line)
        if (content === null) {
          continue
        }
        if (content === undefined) {
          return
        }
        if (content.length > 0) {
          yield content
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function contentFromSseLine(line: string): string | null | undefined {
  const trimmed = line.replace(/\r$/, '').trim()
  if (!trimmed.startsWith('data:')) {
    return null
  }
  const data = trimmed.slice('data:'.length).trim()
  if (data === '[DONE]') {
    return undefined
  }
  if (data === '') {
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    throw new TranslationError('malformed stream')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new TranslationError('malformed stream')
  }

  const content = (
    parsed as {
      choices?: Array<{ delta?: { content?: unknown } }>
    }
  ).choices?.[0]?.delta?.content

  if (content === undefined || content === null) {
    return null
  }
  if (typeof content !== 'string') {
    throw new TranslationError('malformed stream')
  }
  return content
}
