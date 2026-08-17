import { describe, expect, it, vi } from 'vitest'
import { CHAT_COMPLETIONS_URL, HEALTH_URL, SAMPLING } from './constants'
import { ConnectionError, createInference, TranslationError } from './inference'

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`
}

describe('Inference', () => {
  it('checks health at the local llama.cpp endpoint', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(HEALTH_URL)
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    })
    const inference = createInference(fetchFn)
    await expect(inference.checkHealth()).resolves.toBe('ready')
  })

  it('streams chat completions with model-card sampling values', async () => {
    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe(CHAT_COMPLETIONS_URL)
        expect(init?.method).toBe('POST')
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>
        expect(body.stream).toBe(true)
        expect(body.temperature).toBe(SAMPLING.temperature)
        expect(body.top_k).toBe(SAMPLING.top_k)
        expect(body.repeat_penalty).toBe(SAMPLING.repeat_penalty)
        expect(body.messages).toEqual([
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'こんにちは' },
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
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'こんにちは' },
      ],
      new AbortController().signal,
    )) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual(['Hel', 'lo'])
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
      inference.translate([], new AbortController().signal).next(),
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
      inference.translate([], new AbortController().signal).next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('treats a missing completion body as a translation error', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 200 }))
    const inference = createInference(fetchFn)

    await expect(
      inference.translate([], new AbortController().signal).next(),
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
      inference.translate([], new AbortController().signal).next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('rethrows an AbortError from the stream unchanged', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError')
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
      inference.translate([], new AbortController().signal).next(),
    ).rejects.toBe(abortError)
  })

  it('treats a failed fetch as a connection error', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const inference = createInference(fetchFn)
    await expect(
      inference.translate([], new AbortController().signal).next(),
    ).rejects.toBeInstanceOf(ConnectionError)
  })

  it('treats an HTTP error from completions as a translation error', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }))
    const inference = createInference(fetchFn)
    await expect(
      inference.translate([], new AbortController().signal).next(),
    ).rejects.toBeInstanceOf(TranslationError)
  })

  it('passes AbortSignal to fetch', async () => {
    const controller = new AbortController()
    const fetchFn = vi.fn(async (_input, init?: RequestInit) => {
      expect(init?.signal).toBe(controller.signal)
      return new Response('{"status":"ok"}', { status: 200 })
    })
    await createInference(fetchFn).checkHealth(controller.signal)
    expect(fetchFn).toHaveBeenCalled()
  })
})
