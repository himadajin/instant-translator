import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_COMPLETIONS_URL,
  DEBOUNCE_MS,
  HEALTH_URL,
  INFERENCE_BASE_URL,
  INPUT_LIMIT,
  INPUT_WARN_AT,
  STORAGE_KEY,
} from './constants'
import { createSession } from './session'
import type { Inference } from './inference'
import type { ConnectionStatus, KeyValueStorage, WorkState } from './types'

function memoryStorage(initial?: Record<string, string>): KeyValueStorage {
  const data = new Map(Object.entries(initial ?? {}))
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
    removeItem(key) {
      data.delete(key)
    },
  }
}

function sseChunk(text: string): Uint8Array {
  return new TextEncoder().encode(
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
  )
}

function sseDone(): Uint8Array {
  return new TextEncoder().encode('data: [DONE]\n\n')
}

function createStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    body,
    push(text: string) {
      controller?.enqueue(sseChunk(text))
    },
    done() {
      controller?.enqueue(sseDone())
      controller?.close()
    },
    fail(error: unknown) {
      controller?.error(error)
    },
    response() {
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    },
  }
}

type CompletionsCall = {
  url: string
  body: {
    messages: Array<{ role: string; content: string }>
    stream: boolean
  }
  signal?: AbortSignal
}

function sourceFrom(content: string): string {
  const match = /^\[Source Text\]\n([\s\S]*)\n\n\[Translation Tasks\]\n/.exec(
    content,
  )
  return match?.[1] ?? ''
}

function requestedSource(call: CompletionsCall | undefined): string {
  return sourceFrom(call?.body.messages[0]?.content ?? '')
}

function createFetchHarness(options?: { health?: 'ok' | 'down' }) {
  const completions: CompletionsCall[] = []
  const streams: ReturnType<typeof createStream>[] = []
  const urls: string[] = []

  const fetchFn = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      urls.push(url)
      if (url === HEALTH_URL) {
        if (options?.health === 'down') {
          throw new TypeError('Failed to fetch')
        }
        return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
      }
      if (url === CHAT_COMPLETIONS_URL) {
        const body = JSON.parse(String(init?.body)) as CompletionsCall['body']
        completions.push({ url, body, signal: init?.signal ?? undefined })
        const stream = createStream()
        streams.push(stream)
        return stream.response()
      }
      throw new Error(`unexpected URL ${url}`)
    },
  )

  return { fetchFn, completions, streams, urls }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve()
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

const japaneseSource = 'こんにちは、今日は良い天気です。'
const englishSource = 'Hello, how are you today?'

describe('Session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1. translates Japanese toward English and English toward Japanese without calling Inference to detect', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource(japaneseSource)
    expect(session.getSnapshot().direction).toBe('ja-to-en')
    expect(harness.completions).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(1)
    expect(requestedSource(harness.completions[0])).toBe(japaneseSource)

    harness.streams[0]?.done()
    await flush()

    session.setSource(englishSource)
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(2)
    expect(requestedSource(harness.completions[1])).toBe(englishSource)
    expect(
      harness.urls.every((url) => url.startsWith(INFERENCE_BASE_URL)),
    ).toBe(true)
    session.dispose()
  })

  it('2. keeps the settled direction for short or mixed input, defaulting to Japanese to English', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource('Hi')
    expect(session.getSnapshot().direction).toBe('ja-to-en')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.done()
    await flush()

    session.setSource(englishSource)
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[1]?.done()
    await flush()

    session.setSource('This is 日本語の test case')
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    session.dispose()
  })

  it('3. ignores Detection while fixed, locks on swap, and re-detects after unlock', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.done()
    await flush()

    session.swapDirection()
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    expect(session.getSnapshot().directionControl).toBe('fixed')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[1]?.done()
    await flush()

    session.swapDirection()
    expect(session.getSnapshot().direction).toBe('ja-to-en')
    expect(session.getSnapshot().directionControl).toBe('fixed')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[2]?.done()
    await flush()

    session.setSource(englishSource)
    expect(session.getSnapshot().direction).toBe('ja-to-en')
    expect(session.getSnapshot().directionControl).toBe('fixed')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[3]?.done()
    await flush()

    session.unlockDirection()
    expect(session.getSnapshot().directionControl).toBe('auto')
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    session.dispose()
  })

  it('4. starts translation 400ms after input stops and does not send fragments sooner', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource('こん')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    session.setSource('こんに')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    expect(harness.completions).toHaveLength(0)

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    expect(harness.completions).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(harness.completions).toHaveLength(1)
    expect(requestedSource(harness.completions[0])).toBe(japaneseSource)
    session.dispose()
  })

  it('5. does not let an older stream overwrite the latest translation', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Old')
    await flush()
    expect(session.getSnapshot().translation).toBe('Old')

    session.setSource('ありがとうございます。')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(2)

    harness.streams[1]?.push('New')
    await flush()
    harness.streams[0]?.push(' stale')
    harness.streams[0]?.done()
    await flush()
    expect(session.getSnapshot().translation).toBe('New')

    harness.streams[1]?.push('er')
    harness.streams[1]?.done()
    await flush()
    expect(session.getSnapshot().translation).toBe('Newer')
    session.dispose()
  })

  it('invalidates in-flight chunks as soon as the source changes, before the next request starts', async () => {
    const storage = memoryStorage()
    const harness = createFetchHarness()
    const session = createSession({ fetch: harness.fetchFn, storage })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hel')
    await flush()
    expect(session.getSnapshot().translation).toBe('Hel')
    expect(session.getSnapshot().translationIsCurrent).toBe(true)

    const nextSource = 'ありがとうございます。'
    session.setSource(nextSource)
    expect(session.getSnapshot().source).toBe(nextSource)
    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    expect(harness.completions).toHaveLength(1)

    harness.streams[0]?.push('lo')
    harness.streams[0]?.done()
    await flush()

    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    expect(session.getSnapshot().translation).toBe('Hel')
    expect(session.getSnapshot().translationStatus).not.toBe('complete')
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as WorkState
    expect(saved.source).toBe(nextSource)
    expect(saved.completedTranslation).toBe('')
    expect(harness.completions).toHaveLength(1)
    session.dispose()
  })

  it('6. grows the translation while streaming and persists only the completed text', async () => {
    const storage = memoryStorage()
    const harness = createFetchHarness()
    const session = createSession({ fetch: harness.fetchFn, storage })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hel')
    await flush()
    expect(session.getSnapshot().translation).toBe('Hel')
    expect(session.getSnapshot().translationStatus).toBe('translating')
    expect(
      JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').completedTranslation,
    ).toBe('')

    harness.streams[0]?.push('lo')
    await flush()
    expect(session.getSnapshot().translation).toBe('Hello')

    harness.streams[0]?.done()
    await flush()
    expect(session.getSnapshot().translationStatus).toBe('complete')
    expect(
      JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').completedTranslation,
    ).toBe('Hello')

    session.setSource('ありがとうございます。')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[1]?.push('Th')
    await flush()
    expect(
      JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').completedTranslation,
    ).toBe('Hello')
    session.dispose()
  })

  it('7. does not start translation over 4000 characters, keeps the full source, and resumes after 400ms', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hello')
    harness.streams[0]?.done()
    await flush()

    const over = `${'あ'.repeat(INPUT_LIMIT)}ん`
    session.setSource(over)
    expect(session.getSnapshot().source).toBe(over)
    expect(session.getSnapshot().sourceLength).toBe(INPUT_LIMIT + 1)
    expect(session.getSnapshot().overLimit).toBe(true)
    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(1)

    const within = 'あ'.repeat(INPUT_LIMIT)
    session.setSource(within)
    expect(session.getSnapshot().source).toBe(within)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    expect(harness.completions).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    await flush()
    expect(harness.completions).toHaveLength(2)
    expect(requestedSource(harness.completions[1])).toBe(within)
    session.dispose()
  })

  it('uses grapheme clusters for warning data and the input boundary', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    const atWarning = 'e\u0301'.repeat(INPUT_WARN_AT)
    session.setSource(atWarning)
    expect(session.getSnapshot().sourceLength).toBe(INPUT_WARN_AT)
    expect(session.getSnapshot().overLimit).toBe(false)

    const overWarning = `${atWarning}e\u0301`
    session.setSource(overWarning)
    expect(session.getSnapshot().sourceLength).toBe(INPUT_WARN_AT + 1)
    expect(session.getSnapshot().overLimit).toBe(false)
    session.dispose()
  })

  it('accepts a long UTF-16 string when its grapheme count is within the limit', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    const withinByGraphemes = '😀'.repeat(2001)
    expect(withinByGraphemes.length).toBeGreaterThan(INPUT_LIMIT)
    session.setSource(withinByGraphemes)
    expect(session.getSnapshot().sourceLength).toBe(2001)
    expect(session.getSnapshot().overLimit).toBe(false)

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(1)
    expect(requestedSource(harness.completions[0])).toBe(withinByGraphemes)
    session.dispose()
  })

  it('accepts exactly 4,000 graphemes and blocks 4,001 graphemes', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    const exactlyAtLimit = 'e\u0301'.repeat(INPUT_LIMIT)
    session.setSource(exactlyAtLimit)
    expect(session.getSnapshot().sourceLength).toBe(INPUT_LIMIT)
    expect(session.getSnapshot().overLimit).toBe(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(1)

    const justOverLimit = `${exactlyAtLimit}e\u0301`
    session.setSource(justOverLimit)
    expect(session.getSnapshot().sourceLength).toBe(INPUT_LIMIT + 1)
    expect(session.getSnapshot().overLimit).toBe(true)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(1)
    session.dispose()
  })

  it('8. clear removes source, translation, and saved texts; restore loads completed work state only', async () => {
    const storage = memoryStorage()
    const harness = createFetchHarness()
    const session = createSession({ fetch: harness.fetchFn, storage })
    await flush()

    session.setSource(japaneseSource)
    session.setMethod('idiomatic')
    session.setTone('technical')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hello')
    harness.streams[0]?.done()
    await flush()

    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as WorkState
    expect(saved.source).toBe(japaneseSource)
    expect(saved.completedTranslation).toBe('Hello')
    expect(saved.method).toBe('idiomatic')
    expect(saved.tone).toBe('technical')
    session.dispose()

    const restored = createSession({
      fetch: createFetchHarness().fetchFn,
      storage,
    })
    await flush()
    expect(restored.getSnapshot().source).toBe(japaneseSource)
    expect(restored.getSnapshot().translation).toBe('Hello')
    expect(restored.getSnapshot().method).toBe('idiomatic')
    expect(restored.getSnapshot().tone).toBe('technical')
    expect(restored.getSnapshot().translationStatus).toBe('complete')
    restored.dispose()

    const live = createSession({ fetch: harness.fetchFn, storage })
    await flush()
    live.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    live.clear()
    expect(live.getSnapshot().source).toBe('')
    expect(live.getSnapshot().translation).toBe('')
    const cleared = JSON.parse(
      storage.getItem(STORAGE_KEY) ?? '{}',
    ) as WorkState
    expect(cleared.source).toBe('')
    expect(cleared.completedTranslation).toBe('')
    expect(cleared.method).toBe('idiomatic')
    expect(cleared.tone).toBe('technical')
    live.dispose()
  })

  it('9. distinguishes connection failure from translation failure, keeps source, and retries only the latest', async () => {
    const completions: CompletionsCall[] = []
    const urls: string[] = []
    let mode: 'connect' | 'translate' | 'ok' = 'connect'
    const streams: ReturnType<typeof createStream>[] = []

    const fetchFn = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        urls.push(url)
        if (url === HEALTH_URL) {
          return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
        }
        if (url !== CHAT_COMPLETIONS_URL) {
          throw new Error(`unexpected URL ${url}`)
        }
        const body = JSON.parse(String(init?.body)) as CompletionsCall['body']
        completions.push({ url, body, signal: init?.signal ?? undefined })
        if (mode === 'connect') {
          throw new TypeError('Failed to fetch')
        }
        if (mode === 'translate') {
          return new Response('error', { status: 500 })
        }
        const stream = createStream()
        streams.push(stream)
        return stream.response()
      },
    )

    const session = createSession({ fetch: fetchFn, storage: memoryStorage() })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(session.getSnapshot().translationStatus).toBe('connection-failed')
    expect(session.getSnapshot().source).toBe(japaneseSource)

    mode = 'translate'
    session.setSource(englishSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(session.getSnapshot().translationStatus).toBe('translation-failed')
    expect(session.getSnapshot().source).toBe(englishSource)

    mode = 'ok'
    session.retry()
    await flush()
    expect(requestedSource(completions.at(-1))).toBe(englishSource)
    streams[0]?.push('こんにちは')
    streams[0]?.done()
    await flush()
    expect(session.getSnapshot().translation).toBe('こんにちは')
    expect(session.getSnapshot().translationStatus).toBe('complete')
    session.dispose()
  })

  it('10. sends requests only to the local OpenAI-compatible endpoints', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    await session.checkConnection()
    await flush()

    expect(harness.urls.length).toBeGreaterThan(0)
    expect(
      harness.urls.every(
        (url) => url === HEALTH_URL || url === CHAT_COMPLETIONS_URL,
      ),
    ).toBe(true)
    expect(harness.urls).toContain(HEALTH_URL)
    expect(harness.urls).toContain(CHAT_COMPLETIONS_URL)
    expect(harness.completions[0]?.body.stream).toBe(true)
    session.dispose()
  })

  it('does not treat a previous translation as current while waiting for the first new chunk', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hello')
    harness.streams[0]?.done()
    await flush()

    session.setSource('ありがとうございます。')
    expect(session.getSnapshot().translation).toBe('Hello')
    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    harness.streams[1]?.push('Thanks')
    await flush()
    expect(session.getSnapshot().translation).toBe('Thanks')
    expect(session.getSnapshot().translationIsCurrent).toBe(true)
    session.dispose()
  })

  it('starts with standard method and standard tone', async () => {
    const session = createSession({
      fetch: createFetchHarness().fetchFn,
      storage: memoryStorage(),
    })
    await flush()
    expect(session.getSnapshot().method).toBe('standard')
    expect(session.getSnapshot().tone).toBe('standard')
    expect(session.getSnapshot().directionControl).toBe('auto')
    expect(session.getSnapshot().direction).toBe('ja-to-en')
    session.dispose()
  })

  it('restores an old completed result as non-current and retranslates a newer source', async () => {
    const storage = memoryStorage()
    const harness = createFetchHarness()
    const session = createSession({ fetch: harness.fetchFn, storage })
    await flush()

    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hello')
    harness.streams[0]?.done()
    await flush()

    const newerSource = 'ありがとうございます。'
    session.setSource(newerSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(2)
    session.dispose()

    const restoredHarness = createFetchHarness()
    const restored = createSession({
      fetch: restoredHarness.fetchFn,
      storage,
    })
    await flush()
    expect(restored.getSnapshot().source).toBe(newerSource)
    expect(restored.getSnapshot().translation).toBe('Hello')
    expect(restored.getSnapshot().translationIsCurrent).toBe(false)
    expect(restored.getSnapshot().translationStatus).toBe('waiting')
    expect(restoredHarness.completions).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(restoredHarness.completions).toHaveLength(1)
    expect(requestedSource(restoredHarness.completions[0])).toBe(newerSource)
    restored.dispose()
  })

  it('restores an exact completed provenance without requesting another translation', async () => {
    const storage = memoryStorage()
    const firstHarness = createFetchHarness()
    const first = createSession({ fetch: firstHarness.fetchFn, storage })
    await flush()
    first.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    firstHarness.streams[0]?.push('Hello')
    firstHarness.streams[0]?.done()
    await flush()
    first.dispose()

    const restoredHarness = createFetchHarness()
    const restored = createSession({
      fetch: restoredHarness.fetchFn,
      storage,
    })
    await flush()
    expect(restored.getSnapshot().translation).toBe('Hello')
    expect(restored.getSnapshot().translationIsCurrent).toBe(true)
    expect(restored.getSnapshot().translationStatus).toBe('complete')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(restoredHarness.completions).toHaveLength(0)
    restored.dispose()
  })

  it('does not request a restored over-limit source', async () => {
    const storage = memoryStorage()
    const firstHarness = createFetchHarness()
    const first = createSession({ fetch: firstHarness.fetchFn, storage })
    await flush()
    first.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    firstHarness.streams[0]?.push('Hello')
    firstHarness.streams[0]?.done()
    await flush()

    const overLimitSource = `${'あ'.repeat(INPUT_LIMIT)}ん`
    first.setSource(overLimitSource)
    first.dispose()

    const restoredHarness = createFetchHarness()
    const restored = createSession({
      fetch: restoredHarness.fetchFn,
      storage,
    })
    await flush()
    expect(restored.getSnapshot().source).toBe(overLimitSource)
    expect(restored.getSnapshot().translation).toBe('Hello')
    expect(restored.getSnapshot().translationIsCurrent).toBe(false)
    expect(restored.getSnapshot().translationStatus).toBe('idle')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2)
    await flush()
    expect(restoredHarness.completions).toHaveLength(0)
    restored.dispose()
  })

  it('treats a [DONE]-only stream after a completion as a translation failure', async () => {
    const storage = memoryStorage()
    const harness = createFetchHarness()
    const session = createSession({ fetch: harness.fetchFn, storage })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hello')
    harness.streams[0]?.done()
    await flush()

    const newerSource = 'ありがとうございます。'
    session.setSource(newerSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[1]?.done()
    await flush()

    expect(session.getSnapshot().translation).toBe('Hello')
    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    expect(session.getSnapshot().translationStatus).toBe('translation-failed')
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as WorkState
    expect(saved.completedTranslation).toBe('Hello')
    expect(saved.completedSource).toBe(japaneseSource)
    session.dispose()
  })

  it('treats a first [DONE]-only stream as a translation failure without completed text', async () => {
    const storage = memoryStorage()
    const harness = createFetchHarness()
    const session = createSession({ fetch: harness.fetchFn, storage })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.done()
    await flush()

    expect(session.getSnapshot().translation).toBe('')
    expect(session.getSnapshot().translationIsCurrent).toBe(false)
    expect(session.getSnapshot().translationStatus).toBe('translation-failed')
    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as WorkState
    expect(saved.completedTranslation).toBe('')
    expect(saved.completedSource).toBe('')
    session.dispose()
  })

  it('starts exactly one initial health check', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()
    expect(harness.urls.filter((url) => url === HEALTH_URL)).toHaveLength(1)
    session.dispose()
  })

  it('ignores stale health responses after a newer health result', async () => {
    const first = deferred<ConnectionStatus>()
    const second = deferred<ConnectionStatus>()
    const responses = [first, second]
    const inference: Inference = {
      checkHealth: vi.fn(() => responses.shift()!.promise),
      async *translate() {
        yield 'unused'
      },
    }
    const session = createSession({
      inference,
      storage: memoryStorage(),
    })
    await flush()
    const newerCheck = session.checkConnection()
    second.resolve('ready')
    await newerCheck
    first.resolve('unavailable')
    await flush()
    expect(session.getSnapshot().connectionStatus).toBe('ready')
    session.dispose()
  })

  it('lets a translation result win over a stale initial health response', async () => {
    const health = deferred<ConnectionStatus>()
    const translate = vi.fn(async function* () {
      yield 'Hello'
    })
    const inference: Inference = {
      checkHealth: vi.fn(() => health.promise),
      translate,
    }
    const session = createSession({
      inference,
      storage: memoryStorage(),
    })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(session.getSnapshot().translationStatus).toBe('complete')
    health.resolve('unavailable')
    await flush()
    expect(session.getSnapshot().connectionStatus).toBe('ready')
    expect(translate).toHaveBeenCalledTimes(1)
    session.dispose()
  })

  it('retries the latest source once without starting another health check', async () => {
    const sources: string[] = []
    const inference: Inference = {
      checkHealth: vi.fn(async (): Promise<ConnectionStatus> => 'ready'),
      async *translate(messages) {
        sources.push(sourceFrom(messages[0]?.content ?? ''))
        yield 'Latest'
      },
    }
    const session = createSession({
      inference,
      storage: memoryStorage(),
    })
    await flush()
    const latestSource = '最新の原文です。'
    session.setSource('古い原文です。')
    session.setSource(latestSource)
    session.retry()
    await flush()
    expect(sources).toEqual([latestSource])
    expect(inference.checkHealth).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().translationStatus).toBe('complete')
    session.dispose()
  })
})
