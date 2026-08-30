import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEBOUNCE_MS,
  INPUT_LIMIT,
  INPUT_WARN_AT,
  PROFILES_STORAGE_KEY,
  STORAGE_KEY,
} from './constants'
import { createSession } from './session'
import type { Inference } from './inference'
import type { ProfileState } from './profiles'
import type { ConnectionStatus, KeyValueStorage, WorkState } from './types'

// The seeded default profile targets the local llama-server.
const DEFAULT_BASE_URL = 'http://127.0.0.1:8080/v1'
const MODELS_URL = `${DEFAULT_BASE_URL}/models`
const CHAT_COMPLETIONS_URL = `${DEFAULT_BASE_URL}/chat/completions`

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
      if (url === MODELS_URL) {
        if (options?.health === 'down') {
          throw new TypeError('Failed to fetch')
        }
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
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

  it('1. translates toward the selected target without calling Inference to detect', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource(japaneseSource)
    expect(session.getSnapshot().detectedLanguage).toBe('japanese')
    expect(session.getSnapshot().targetLanguage).toBe('english')
    expect(harness.completions).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(1)
    expect(requestedSource(harness.completions[0])).toBe(japaneseSource)

    harness.streams[0]?.done()
    await flush()

    session.setTargetLanguage('japanese')
    session.setSource(englishSource)
    expect(session.getSnapshot().detectedLanguage).toBe('english')
    expect(session.getSnapshot().targetLanguage).toBe('japanese')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(2)
    expect(requestedSource(harness.completions[1])).toBe(englishSource)
    expect(harness.urls.every((url) => url.startsWith(DEFAULT_BASE_URL))).toBe(
      true,
    )
    session.dispose()
  })

  it('2. treats ambiguous automatic input as the language opposite the selected target', async () => {
    const harness = createFetchHarness()
    const session = createSession({
      fetch: harness.fetchFn,
      storage: memoryStorage(),
    })
    await flush()

    session.setSource('Hi')
    expect(session.getSnapshot().detectedLanguage).toBe('ambiguous')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.done()
    await flush()

    session.setTargetLanguage('japanese')
    session.setSource(englishSource)
    expect(session.getSnapshot().detectedLanguage).toBe('english')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[1]?.done()
    await flush()

    session.setSource('This is 日本語の test case')
    expect(session.getSnapshot().detectedLanguage).toBe('ambiguous')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    session.dispose()
  })

  it('3. supports explicit source selection and blocks equal source and target languages', async () => {
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

    session.setTargetLanguage('japanese')
    session.setSourceLanguage('english')
    expect(session.getSnapshot().sourceLanguage).toBe('english')
    expect(session.getSnapshot().targetLanguage).toBe('japanese')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[1]?.done()
    await flush()

    session.setSource(japaneseSource)
    expect(session.getSnapshot().detectedLanguage).toBe('japanese')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[2]?.done()
    await flush()

    session.setSourceLanguage('japanese')
    expect(session.getSnapshot().sourceLanguage).toBe('english')
    session.setSourceLanguage('auto')
    expect(session.getSnapshot().translationStatus).toBe('language-conflict')
    expect(harness.completions).toHaveLength(3)

    session.setTargetLanguage('english')
    expect(session.getSnapshot().translationStatus).toBe('waiting')
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
    session.setTargetLanguage('japanese')

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
    session.setIdiomatic(true)
    session.setTone('technical')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    harness.streams[0]?.push('Hello')
    harness.streams[0]?.done()
    await flush()

    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}') as WorkState
    expect(saved.source).toBe(japaneseSource)
    expect(saved.completedTranslation).toBe('Hello')
    expect(saved.idiomatic).toBe(true)
    expect(saved.tone).toBe('technical')
    session.dispose()

    const restored = createSession({
      fetch: createFetchHarness().fetchFn,
      storage,
    })
    await flush()
    expect(restored.getSnapshot().source).toBe(japaneseSource)
    expect(restored.getSnapshot().translation).toBe('Hello')
    expect(restored.getSnapshot().idiomatic).toBe(true)
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
    expect(cleared.idiomatic).toBe(true)
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
        if (url === MODELS_URL) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 })
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
    session.setTargetLanguage('japanese')
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

  it("10. sends requests only to the selected profile's OpenAI-compatible endpoints", async () => {
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
        (url) => url === MODELS_URL || url === CHAT_COMPLETIONS_URL,
      ),
    ).toBe(true)
    expect(harness.urls).toContain(MODELS_URL)
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

  it('starts with idiomatic disabled and standard tone', async () => {
    const session = createSession({
      fetch: createFetchHarness().fetchFn,
      storage: memoryStorage(),
    })
    await flush()
    expect(session.getSnapshot().idiomatic).toBe(false)
    expect(session.getSnapshot().tone).toBe('standard')
    expect(session.getSnapshot().sourceLanguage).toBe('auto')
    expect(session.getSnapshot().targetLanguage).toBe('english')
    expect(session.getSnapshot().detectedLanguage).toBe('ambiguous')
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
    expect(harness.urls.filter((url) => url === MODELS_URL)).toHaveLength(1)
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
      async *translate(_profile, messages) {
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

  it('seeds a default llama.cpp profile, persists it, and restores it with the same id', async () => {
    const storage = memoryStorage()
    const session = createSession({
      fetch: createFetchHarness().fetchFn,
      storage,
    })
    await flush()
    const snapshot = session.getSnapshot()
    expect(snapshot.profiles).toHaveLength(1)
    expect(snapshot.profiles[0]?.baseUrl).toBe(DEFAULT_BASE_URL)
    expect(snapshot.profiles[0]?.apiKey).toBe('')
    expect(snapshot.profiles[0]?.model).toBe('')
    expect(snapshot.profiles[0]?.parameters).toEqual({
      temperature: 0.7,
      top_p: 0.6,
      top_k: 20,
      repeat_penalty: 1.05,
    })
    expect(snapshot.selectedProfileId).toBe(snapshot.profiles[0]?.id)
    const saved = JSON.parse(
      storage.getItem(PROFILES_STORAGE_KEY) ?? 'null',
    ) as ProfileState
    expect(saved.selectedId).toBe(snapshot.selectedProfileId)
    session.dispose()

    const restored = createSession({
      fetch: createFetchHarness().fetchFn,
      storage,
    })
    await flush()
    expect(restored.getSnapshot().selectedProfileId).toBe(saved.selectedId)
    restored.dispose()
  })

  it('checks the new profile and retranslates the current source when switching profiles', async () => {
    const remoteBase = 'https://openrouter.ai/api/v1'
    const calls: string[] = []
    const inference: Inference = {
      checkHealth: vi.fn(async (profile): Promise<ConnectionStatus> => {
        calls.push(`health:${profile.baseUrl}`)
        return 'ready'
      }),
      async *translate(profile) {
        calls.push(`translate:${profile.baseUrl}`)
        yield 'Hello'
      },
    }
    const session = createSession({ inference, storage: memoryStorage() })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(calls).toContain(`translate:${DEFAULT_BASE_URL}`)
    calls.length = 0

    session.addProfile({
      name: 'OpenRouter',
      baseUrl: remoteBase,
      apiKey: 'or-key',
      model: 'some/model',
      parameters: {},
    })
    expect(session.getSnapshot().profiles).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(calls).toEqual([])

    const remoteId = session.getSnapshot().profiles[1]!.id
    session.selectProfile(remoteId)
    await flush()
    expect(calls).toContain(`health:${remoteBase}`)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(calls).toContain(`translate:${remoteBase}`)
    expect(session.getSnapshot().selectedProfileId).toBe(remoteId)
    session.dispose()
  })

  it('marks authentication failure distinctly from connection failure', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === MODELS_URL) {
        return new Response(JSON.stringify({ data: [] }), { status: 200 })
      }
      return new Response('unauthorized', { status: 401 })
    })
    const session = createSession({ fetch: fetchFn, storage: memoryStorage() })
    await flush()
    session.setSource(japaneseSource)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(session.getSnapshot().translationStatus).toBe('auth-failed')
    expect(session.getSnapshot().connectionStatus).toBe('auth-failed')
    expect(session.getSnapshot().source).toBe(japaneseSource)
    session.dispose()
  })

  it('updates and deletes profiles, keeping at least one and reselecting after deletion', async () => {
    const storage = memoryStorage()
    const calls: string[] = []
    const inference: Inference = {
      checkHealth: vi.fn(async (profile): Promise<ConnectionStatus> => {
        calls.push(`health:${profile.baseUrl}`)
        return 'ready'
      }),
      async *translate() {
        yield 'Hello'
      },
    }
    const session = createSession({ inference, storage })
    await flush()
    const defaultId = session.getSnapshot().selectedProfileId

    session.addProfile({
      name: 'OpenAI',
      baseUrl: ' https://api.openai.com/v1/ ',
      apiKey: 'sk-key',
      model: 'gpt-5.2',
      parameters: { temperature: 0.3 },
    })
    const added = session.getSnapshot().profiles[1]!
    expect(added.baseUrl).toBe('https://api.openai.com/v1')

    session.selectProfile(added.id)
    await flush()
    calls.length = 0
    session.updateProfile(added.id, {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-key-2',
      model: 'gpt-5.2',
      parameters: {},
    })
    await flush()
    expect(calls).toContain('health:https://api.openai.com/v1')
    expect(session.getSnapshot().profiles[1]?.apiKey).toBe('sk-key-2')

    session.deleteProfile(added.id)
    expect(session.getSnapshot().profiles).toHaveLength(1)
    expect(session.getSnapshot().selectedProfileId).toBe(defaultId)

    session.deleteProfile(defaultId)
    expect(session.getSnapshot().profiles).toHaveLength(1)

    const saved = JSON.parse(
      storage.getItem(PROFILES_STORAGE_KEY) ?? 'null',
    ) as ProfileState
    expect(saved.profiles).toHaveLength(1)
    expect(saved.selectedId).toBe(defaultId)
    session.dispose()
  })
})
