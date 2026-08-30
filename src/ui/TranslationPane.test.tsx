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
    sourceLanguage: 'unspecified',
    targetLanguage: 'english',
    onTargetLanguageChange: vi.fn(),
    idiomatic: false,
    onIdiomaticChange: vi.fn(),
    tone: 'standard',
    onToneChange: vi.fn(),
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
  it('changes target and translation style in the translation pane', async () => {
    const user = userEvent.setup()
    const onTargetLanguageChange = vi.fn()
    const onIdiomaticChange = vi.fn()
    const onToneChange = vi.fn()
    renderTranslation({
      onTargetLanguageChange,
      onIdiomaticChange,
      onToneChange,
    })

    await user.click(screen.getByRole('combobox', { name: '訳文の言語' }))
    await user.click(screen.getByRole('option', { name: '日本語' }))
    expect(onTargetLanguageChange).toHaveBeenCalledWith('japanese')

    await user.click(screen.getByRole('combobox', { name: '口調' }))
    await user.click(screen.getByRole('option', { name: '技術文書の口調' }))
    expect(onToneChange).toHaveBeenCalledWith('technical')

    await user.click(screen.getByRole('button', { name: '意訳' }))
    expect(onIdiomaticChange).toHaveBeenCalledWith(true)
  })

  it('exposes the idiomatic toggle state to assistive technology', () => {
    renderTranslation({ idiomatic: true })

    expect(
      screen.getByRole('button', { name: '意訳' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('disables the explicitly selected source language as a target', async () => {
    const user = userEvent.setup()
    renderTranslation({ sourceLanguage: 'japanese' })

    await user.click(screen.getByRole('combobox', { name: '訳文の言語' }))
    expect(
      screen
        .getByRole('option', { name: '日本語' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it.each([
    ['idle', 'idle', 'ここに翻訳結果が表示されます'],
    [
      'pending without a previous result',
      'pending',
      'ここに翻訳結果が表示されます',
    ],
  ] as const)(
    '%s shows its placeholder and keeps copy disabled',
    (_label, status, text) => {
      renderTranslation({
        translationStatus: status,
        translatedText: '',
      })

      expect(screen.getByText(text)).toBeDefined()
      expect(screen.getByRole('button', { name: 'コピー' })).toHaveProperty(
        'disabled',
        true,
      )
      expectAnnouncement(status === 'idle' ? '' : '翻訳を開始しました')
    },
  )

  it('shows a progress indicator only while translating', () => {
    const view = renderTranslation({ translationStatus: 'pending' })
    expect(screen.getByRole('progressbar')).toBeDefined()

    view.rerender(
      <TranslationPane
        translationStatus="done"
        translatedText="完成した訳文"
        inputLimit={4000}
        sourceLanguage="unspecified"
        targetLanguage="english"
        onTargetLanguageChange={vi.fn()}
        idiomatic={false}
        onIdiomaticChange={vi.fn()}
        tone="standard"
        onToneChange={vi.fn()}
        onCopy={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('shows a pending previous result without enabling copy', () => {
    renderTranslation({
      translationStatus: 'pending',
      previousTranslatedText: '前回の訳文',
    })

    expect(screen.getByText('前回の訳文')).toBeDefined()
    expect(screen.getByRole('button', { name: 'コピー' })).toHaveProperty(
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
    expect(screen.getByRole('button', { name: 'コピー' })).toHaveProperty(
      'disabled',
      status !== 'done',
    )
    expectAnnouncement(
      status === 'done' ? '翻訳が完了しました' : '翻訳を開始しました',
    )
  })

  it('places the copy action in the pane bottom toolbar, after the translation', () => {
    renderTranslation({
      translationStatus: 'done',
      translatedText: '完成した訳文',
    })

    const body = screen.getByText('完成した訳文')
    const copy = screen.getByRole('button', { name: 'コピー' })
    expect(
      body.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('copies a completed translation and gives immediate success feedback', async () => {
    const user = userEvent.setup()
    const onCopy = vi.fn(async () => {})
    renderTranslation({
      translationStatus: 'done',
      translatedText: 'コピーする訳文',
      onCopy,
    })

    const copy = screen.getByRole('button', { name: 'コピー' })
    await user.click(copy)

    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'コピーしました' })).toBe(copy)
  })

  it.each([
    ['connection error', 'connectionError', '推論先に接続できません'],
    ['auth error', 'authError', 'API キーが認証されませんでした'],
    ['translation error', 'translationError', '翻訳を完了できませんでした'],
  ] as const)('%s offers a retry action', async (_label, status, message) => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderTranslation({
      translationStatus: status,
      translatedText: '表示してはいけない訳文',
      onRetry,
    })

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(message)
    expect(screen.queryByText('表示してはいけない訳文')).toBeNull()
    expect(screen.getByRole('button', { name: 'コピー' })).toHaveProperty(
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
    expect(screen.getByRole('button', { name: 'コピー' })).toHaveProperty(
      'disabled',
      true,
    )
    expectAnnouncement('原文が上限を超えています')
  })
})
