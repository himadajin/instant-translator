import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHAT_COMPLETIONS_URL,
  DEBOUNCE_MS,
  HEALTH_URL,
  INPUT_LIMIT,
  STORAGE_KEY,
} from './constants'
import { createSession } from './session'
import type { KeyValueStorage, WorkState } from './types'

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
    expect(harness.completions[0]?.body.messages[0]?.content).toContain(
      'Japanese to English',
    )
    expect(harness.completions[0]?.body.messages[0]?.content).toContain(
      'Do not detect or guess the language',
    )
    expect(harness.completions[0]?.body.messages[1]?.content).toBe(
      japaneseSource,
    )

    harness.streams[0]?.done()
    await flush()

    session.setSource(englishSource)
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions).toHaveLength(2)
    expect(harness.completions[1]?.body.messages[0]?.content).toContain(
      'English to Japanese',
    )
    expect(
      harness.urls.every((url) => url.startsWith('http://127.0.0.1:8080')),
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
    expect(harness.completions[0]?.body.messages[0]?.content).toContain(
      'Japanese to English',
    )
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
    expect(harness.completions[2]?.body.messages[0]?.content).toContain(
      'English to Japanese',
    )
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
    expect(harness.completions[1]?.body.messages[0]?.content).toContain(
      'English to Japanese',
    )
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
    expect(harness.completions[3]?.body.messages[0]?.content).toContain(
      'Japanese to English',
    )
    harness.streams[3]?.done()
    await flush()

    session.unlockDirection()
    expect(session.getSnapshot().directionControl).toBe('auto')
    expect(session.getSnapshot().direction).toBe('en-to-ja')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    await flush()
    expect(harness.completions[4]?.body.messages[0]?.content).toContain(
      'English to Japanese',
    )
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
    expect(harness.completions[0]?.body.messages[1]?.content).toBe(
      japaneseSource,
    )
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
    expect(session.getSnapshot().source.length).toBe(INPUT_LIMIT + 1)
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
    expect(harness.completions[1]?.body.messages[1]?.content).toBe(within)
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
    expect(completions.at(-1)?.body.messages[1]?.content).toBe(englishSource)
    expect(completions.at(-1)?.body.messages[0]?.content).toContain(
      'English to Japanese',
    )
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
})
