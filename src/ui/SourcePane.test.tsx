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
  it('renders the supplied grapheme count and input limit without recounting source text', () => {
    renderSource({
      sourceText: 'この原文の長さとは異なる値',
      sourceLength: 123,
      inputLimit: 5000,
    })

    expect(screen.getByText('123/5,000').textContent).toBe('123/5,000')
  })

  it('marks only counts above 3,200 as near the input limit', () => {
    const view = renderSource({ sourceText: 'text', sourceLength: 3200 })
    const atThreshold = screen.getByText('3,200/4,000')
    expect(atThreshold.getAttribute('data-near-limit')).toBeNull()

    view.rerender(
      <SourcePane
        sourceText="text"
        sourceLength={3201}
        overLimit={false}
        inputLimit={4000}
        inputWarnAt={3200}
        onSourceTextChange={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    const aboveThreshold = screen.getByText('3,201/4,000')
    expect(aboveThreshold.getAttribute('data-near-limit')).toBe('true')
  })

  it('shows the exact over-limit amount', () => {
    renderSource({
      sourceText: 'x',
      sourceLength: 4001,
      overLimit: true,
    })

    const count = screen.getByText(/原文が 4,000 文字を/)
    expect(count.getAttribute('data-over-limit')).toBe('true')
    expect(count.textContent).toContain(
      '原文が 4,000 文字を 1 文字超過しています',
    )
  })

  it('enables CLEAR only for non-empty source and forwards user actions', async () => {
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
    const clear = screen.getByRole('button', { name: 'CLEAR' })

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
