// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TranslationPane } from './TranslationPane'

afterEach(cleanup)

function renderTranslation(
  overrides: Partial<Parameters<typeof TranslationPane>[0]> = {},
) {
  const props: Parameters<typeof TranslationPane>[0] = {
    translationStatus: 'idle',
    translatedText: '',
    inputLimit: 4000,
    onCopy: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }

  return { ...render(<TranslationPane {...props} />), props }
}

function expectAnnouncement(text: string) {
  const announcement = screen.getByRole('status')
  expect(announcement.getAttribute('aria-live')).toBe('polite')
  expect(announcement.textContent).toBe(text)
}

describe('TranslationPane', () => {
  it.each([
    ['idle', 'idle', '翻訳結果'],
    ['pending without a previous result', 'pending', '翻訳結果'],
  ] as const)(
    '%s shows its placeholder and keeps COPY disabled',
    (_label, status, text) => {
      renderTranslation({
        translationStatus: status,
        translatedText: '',
      })

      expect(screen.getByText(text)).toBeDefined()
      expect(screen.getByRole('button', { name: 'COPY' })).toHaveProperty(
        'disabled',
        true,
      )
      expectAnnouncement(status === 'idle' ? '' : '翻訳を開始しました')
    },
  )

  it('dims a pending previous result instead of showing it as current', () => {
    renderTranslation({
      translationStatus: 'pending',
      previousTranslatedText: '前回の訳文',
    })

    const previous = screen.getByText('前回の訳文')
    expect(previous.getAttribute('data-dimmed')).toBe('true')
    expect(screen.getByText('前回の訳文')).toBe(previous)
    expect(screen.getByRole('button', { name: 'COPY' })).toHaveProperty(
      'disabled',
      true,
    )
    expectAnnouncement('翻訳を開始しました')
  })

  it.each([
    ['streaming', 'streaming', '逐次生成中の訳文'],
    ['complete', 'done', '完成した訳文'],
  ] as const)('%s shows current translated text', (_label, status, text) => {
    renderTranslation({
      translationStatus: status,
      translatedText: text,
    })

    expect(screen.getByText(text)).toBeDefined()
    expect(screen.getByRole('button', { name: 'COPY' })).toHaveProperty(
      'disabled',
      status !== 'done',
    )
    expectAnnouncement(
      status === 'done' ? '翻訳が完了しました' : '翻訳を開始しました',
    )
  })

  it('copies a completed translation and gives immediate success feedback', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn(async () => {})
    renderTranslation({
      translationStatus: 'done',
      translatedText: 'コピーする訳文',
      onCopy,
    })

    const copy = screen.getByRole('button', { name: 'COPY' })
    await user.click(copy)

    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'COPIED' })).toBe(copy)
    expect(copy.textContent).toBe('COPIED')
  })

  it.each([
    ['connection error', 'connectionError', 'ローカル翻訳に接続できません'],
    ['translation error', 'translationError', '翻訳を完了できませんでした'],
  ] as const)('%s offers a retry action', async (_label, status, message) => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderTranslation({
      translationStatus: status,
      translatedText: '表示してはいけない訳文',
      onRetry,
    })

    const visibleError = screen.getByText(message, { selector: 'p' })
    expect(visibleError.textContent).toBe(message)
    expect(screen.queryByText('表示してはいけない訳文')).toBeNull()
    expect(screen.getByRole('button', { name: 'COPY' })).toHaveProperty(
      'disabled',
      true,
    )
    expectAnnouncement(message)

    await user.click(screen.getByRole('button', { name: '再試行' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the supplied over-limit value without a retry or stale translation', () => {
    renderTranslation({
      translationStatus: 'overLimit',
      translatedText: '古い訳文',
      inputLimit: 1234,
    })

    expect(screen.getByText('原文が 1,234 文字を超えています')).toBeDefined()
    expect(screen.queryByText('古い訳文')).toBeNull()
    expect(screen.queryByRole('button', { name: '再試行' })).toBeNull()
    expect(screen.getByRole('button', { name: 'COPY' })).toHaveProperty(
      'disabled',
      true,
    )
    expectAnnouncement('原文が上限を超えています')
  })
})
