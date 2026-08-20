// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SourcePane } from './SourcePane'

afterEach(cleanup)

function renderSource(
  overrides: Partial<Parameters<typeof SourcePane>[0]> = {},
) {
  const props: Parameters<typeof SourcePane>[0] = {
    sourceText: '',
    sourceLength: 0,
    overLimit: false,
    inputLimit: 4000,
    inputWarnAt: 3200,
    sourceLanguage: 'auto',
    targetLanguage: 'english',
    detectedLanguage: 'ambiguous',
    onSourceLanguageChange: vi.fn(),
    onSourceTextChange: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  }

  return { ...render(<SourcePane {...props} />), props }
}

function ControlledSourcePane({
  onSourceTextChange,
  onClear,
}: Pick<Parameters<typeof SourcePane>[0], 'onSourceTextChange' | 'onClear'>) {
  const [sourceText, setSourceText] = useState('')

  return (
    <SourcePane
      sourceText={sourceText}
      sourceLength={sourceText.length}
      overLimit={false}
      inputLimit={4000}
      inputWarnAt={3200}
      sourceLanguage="auto"
      targetLanguage="english"
      detectedLanguage="ambiguous"
      onSourceLanguageChange={vi.fn()}
      onSourceTextChange={(nextSourceText) => {
        onSourceTextChange(nextSourceText)
        setSourceText(nextSourceText)
      }}
      onClear={() => {
        onClear()
        setSourceText('')
      }}
    />
  )
}

describe('SourcePane', () => {
  it('shows the detected language and disables the selected target language', async () => {
    const user = userEvent.setup()
    renderSource({
      sourceText: 'Hello, world.',
      sourceLength: 13,
      detectedLanguage: 'english',
    })

    expect(screen.getByText('English を検出')).toBeDefined()
    await user.click(screen.getByRole('combobox', { name: '原文の言語' }))
    expect(
      screen
        .getByRole('option', { name: 'English' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('changes the source language through the pane header', async () => {
    const user = userEvent.setup()
    const onSourceLanguageChange = vi.fn()
    renderSource({
      targetLanguage: 'japanese',
      onSourceLanguageChange,
    })

    await user.click(screen.getByRole('combobox', { name: '原文の言語' }))
    await user.click(screen.getByRole('option', { name: 'English' }))
    expect(onSourceLanguageChange).toHaveBeenCalledWith('english')
  })

  it('renders the supplied grapheme count and input limit without recounting source text', () => {
    renderSource({
      sourceText: 'この原文の長さとは異なる値',
      sourceLength: 123,
      inputLimit: 5000,
    })

    expect(screen.getByText('123 / 5,000').textContent).toBe('123 / 5,000')
  })

  it('shows the exact over-limit amount alongside the counter', () => {
    renderSource({
      sourceText: 'x',
      sourceLength: 4001,
      overLimit: true,
    })

    expect(
      screen.getByText('原文が 4,000 文字を 1 文字超過しています'),
    ).toBeDefined()
    expect(screen.getByText('4,001 / 4,000')).toBeDefined()
  })

  it('enables the clear action only for non-empty source and forwards user actions', async () => {
    const user = userEvent.setup()
    const onSourceTextChange = vi.fn()
    const onClear = vi.fn()
    render(
      <ControlledSourcePane
        onSourceTextChange={onSourceTextChange}
        onClear={onClear}
      />,
    )
    const source = screen.getByRole('textbox', { name: '原文' })
    const clear = screen.getByRole('button', { name: '消去' })

    expect(clear).toHaveProperty('disabled', true)
    await user.type(source, 'abc')
    expect(onSourceTextChange).toHaveBeenLastCalledWith('abc')
    expect(source).toHaveProperty('value', 'abc')
    expect(clear).toHaveProperty('disabled', false)
    await user.click(clear)
    expect(onClear).toHaveBeenCalledTimes(1)
    expect(source).toHaveProperty('value', '')
    expect(clear).toHaveProperty('disabled', true)
  })
})
