import { describe, expect, it, vi } from 'vitest'
import {
  AuthError,
  ConnectionError,
  createInference,
  TranslationError,
} from './inference'
import type { Profile } from './profiles'

const localProfile: Profile = {
  id: 'local',
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

const remoteProfile: Profile = {
  id: 'remote',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: 'or-key',
  model: 'some/model',
  parameters: { temperature: 0.3 },
}

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
}

describe('Inference', () => {
  it("checks health at the profile's models endpoint without auth for an empty key", async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('http://127.0.0.1:8080/v1/models')
        expect(init?.headers).toEqual({})
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      },
    )
    const inference = createInference(fetchFn)
    await expect(inference.checkHealth(localProfile)).resolves.toBe('ready')
  })

  it('sends the API key as a bearer token on health checks', async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('https://openrouter.ai/api/v1/models')
        expect(init?.headers).toEqual({ Authorization: 'Bearer or-key' })
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      },
    )
    const inference = createInference(fetchFn)
    await expect(inference.checkHealth(remoteProfile)).resolves.toBe('ready')
  })

  it('reports auth-failed for a 401 or 403 health response', async () => {
    for (const status of [401, 403]) {
      const fetchFn = vi.fn(async () => new Response('denied', { status }))
      const inference = createInference(fetchFn)
      await expect(inference.checkHealth(remoteProfile)).resolves.toBe(
        'auth-failed',
      )
    }
  })

  it('reports unavailable for other failed health responses', async () => {
    const fetchFn = vi.fn(async () => new Response('down', { status: 500 }))
    const inference = createInference(fetchFn)
    await expect(inference.checkHealth(localProfile)).resolves.toBe(
      'unavailable',
    )
  })

  it("streams chat completions with the profile's parameters, omitting an empty model", async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('http://127.0.0.1:8080/v1/chat/completions')
        expect(init?.method).toBe('POST')
        expect(init?.headers).toEqual({ 'Content-Type': 'application/json' })
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        expect(body.stream).toBe(true)
        expect(body.temperature).toBe(0.7)
        expect(body.top_p).toBe(0.6)
        expect(body.top_k).toBe(20)
        expect(body.repeat_penalty).toBe(1.05)
        expect('model' in body).toBe(false)
        expect(body.messages).toEqual([
          { role: 'user', content: 'Translate: こんにちは' },
        ])
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder()
            controller.enqueue(encoder.encode(sseChunk('Hel')))
            controller.enqueue(encoder.encode(sseChunk('lo')))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(stream, { status: 200 })
      },
    )

    const inference = createInference(fetchFn)
    const chunks: string[] = []
    for await (const chunk of inference.translate(
      localProfile,
      [{ role: 'user', content: 'Translate: こんにちは' }],
      new AbortController().signal,
    )) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hel', 'lo'])
  })

  it('sends the model name and bearer token for a remote profile', async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(
          'https://openrouter.ai/api/v1/chat/completions',
        )
        expect(init?.headers).toEqual({
          'Content-Type': 'application/json',
          Authorization: 'Bearer or-key',
        })
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        expect(body.model).toBe('some/model')
        expect(body.temperature).toBe(0.3)
        expect(body.stream).toBe(true)
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseChunk('Hi')))
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(stream, { status: 200 })
      },
    )

    const inference = createInference(fetchFn)
    const chunks: string[] = []
    for await (const chunk of inference.translate(
      remoteProfile,
      [{ role: 'user', content: 'Translate: こんにちは' }],
      new AbortController().signal,
    )) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hi'])
  })

  it('does not let profile parameters override messages, stream, or model', async () => {
    const fetchFn = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        expect(body.stream).toBe(true)
        expect(body.model).toBe('some/model')
        expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }])
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
            controller.close()
          },
        })
        return new Response(stream, { status: 200 })
      },
    )
    const inference = createInference(fetchFn)
    const overriding: Profile = {
      ...remoteProfile,
      parameters: { stream: false, model: 'evil', messages: [] },
    }
    for await (const chunk of inference.translate(
      overriding,
      [{ role: 'user', content: 'Hi' }],
      new AbortController().signal,
    )) {
      void chunk
    }
    expect(fetchFn).toHaveBeenCalled()
  })

  it('treats a 401 or 403 completion response as an auth error', async () => {
    for (const status of [401, 403]) {
      const fetchFn = vi.fn(async () => new Response('denied', { status }))
      const inference = createInference(fetchFn)
      await expect(
        inference
          .translate(remoteProfile, [], new AbortController().signal)
          .next(),
      ).rejects.toBeInstanceOf(AuthError)
    }
  })

  it('treats a stream disconnect after content as a connection error', async () => {
    const fetchFn = vi.fn(async () => {
      let firstRead = true
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (firstRead) {
            firstRead = false
            controller.enqueue(new TextEncoder().encode(sseChunk('Hello')))
            return
          }
          controller.error(new TypeError('socket closed'))
        },
      })
      return new Response(stream, { status: 200 })
    })
    const inference = createInference(fetchFn)
    const chunks: string[] = []

    const consume = async () => {
      for await (const chunk of inference.translate(
        localProfile,
        [],
        new AbortController().signal,
      )) {
        chunks.push(chunk)
      }
    }

    await expect(consume()).rejects.toBeInstanceOf(ConnectionError)
    expect(chunks).toEqual(['Hello'])
  })

  it('treats malformed SSE as a translation error', async () => {
    const fetchFn = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: malformed\n\n'))
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    })
    const inference = createInference(fetchFn)

    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('treats a null SSE payload as a translation error', async () => {
    const fetchFn = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: null\n\n'))
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    })
    const inference = createInference(fetchFn)

    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('treats a missing completion body as a translation error', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const inference = createInference(fetchFn)

    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('treats non-string SSE content as a translation error', async () => {
    const fetchFn = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(
              'data: {"choices":[{"delta":{"content":123}}]}\n\n',
            ),
          )
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    })
    const inference = createInference(fetchFn)

    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('rethrows an AbortError from the stream unchanged', async () => {
    const abortError = new DOMException(
      'The operation was aborted',
      'AbortError',
    )
    const fetchFn = vi.fn(async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(abortError)
        },
      })
      return new Response(stream, { status: 200 })
    })
    const inference = createInference(fetchFn)

    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBe(abortError)
  })

  it('treats a failed fetch as a connection error', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const inference = createInference(fetchFn)
    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBeInstanceOf(ConnectionError)
  })

  it('treats a non-auth HTTP error from completions as a translation error', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }))
    const inference = createInference(fetchFn)
    await expect(
      inference
        .translate(localProfile, [], new AbortController().signal)
        .next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('passes AbortSignal to fetch', async () => {
    const controller = new AbortController()
    const fetchFn = vi.fn(async (_input, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal)
      return new Response(JSON.stringify({ data: [] }), { status: 200 })
    })
    await createInference(fetchFn).checkHealth(localProfile, controller.signal)
    expect(fetchFn).toHaveBeenCalled()
  })
})
