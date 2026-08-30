import type { Profile } from './profiles'
import type { ChatMessage, ConnectionStatus } from './types'

export class ConnectionError extends Error {
  readonly kind = 'connection' as const

  constructor(message = 'connection failed') {
    super(message)
    this.name = 'ConnectionError'
  }
}

export class AuthError extends Error {
  readonly kind = 'auth' as const

  constructor(message = 'authentication failed') {
    super(message)
    this.name = 'AuthError'
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
  checkHealth(profile: Profile, signal?: AbortSignal): Promise<ConnectionStatus>
  translate(
    profile: Profile,
    messages: ChatMessage[],
    signal: AbortSignal,
  ): AsyncGenerator<string>
}

function headersFor(profile: Profile, withBody: boolean): HeadersInit {
  return {
    ...(withBody ? { 'Content-Type': 'application/json' } : {}),
    ...(profile.apiKey !== ''
      ? { Authorization: `Bearer ${profile.apiKey}` }
      : {}),
  }
}

function isAuthStatus(status: number): boolean {
  return status === 401 || status === 403
}

export function createInference(fetchFn: typeof fetch = fetch): Inference {
  return {
    async checkHealth(profile, signal) {
      try {
        const response = await fetchFn(`${profile.baseUrl}/models`, {
          method: 'GET',
          headers: headersFor(profile, false),
          signal,
        })
        if (response.ok) {
          return 'ready'
        }
        return isAuthStatus(response.status) ? 'auth-failed' : 'unavailable'
      } catch (error) {
        if (isAbortError(error)) {
          throw error
        }
        return 'unavailable'
      }
    },

    async *translate(profile, messages, signal) {
      let response: Response
      try {
        response = await fetchFn(`${profile.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: headersFor(profile, true),
          body: JSON.stringify({
            ...profile.parameters,
            messages,
            stream: true,
            ...(profile.model !== '' ? { model: profile.model } : {}),
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

      if (isAuthStatus(response.status)) {
        throw new AuthError(`HTTP ${response.status}`)
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
