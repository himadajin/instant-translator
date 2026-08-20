// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'
import type { Tone } from './types'

afterEach(cleanup)

function renderToolbar({
  tone = 'standard' as Tone,
  isDirectionFixed = false,
} = {}) {
  const onToneChange = vi.fn()
  const onSwapDirection = vi.fn()
  const onReleaseFixedDirection = vi.fn()
  const onTranslationMethodChange = vi.fn()

  render(
    <Toolbar
      direction="jaToEn"
      isDirectionFixed={isDirectionFixed}
      onSwapDirection={onSwapDirection}
      onReleaseFixedDirection={onReleaseFixedDirection}
      translationMethod="standard"
      onTranslationMethodChange={onTranslationMethodChange}
      tone={tone}
      onToneChange={onToneChange}
    />,
  )

  return {
    onToneChange,
    onSwapDirection,
    onReleaseFixedDirection,
    onTranslationMethodChange,
    toneTrigger: screen.getByRole('combobox', { name: '口調' }),
  }
}

function getToneOptions() {
  const listbox = screen.getByRole('listbox', { name: '口調' })
  return {
    listbox,
    options: within(listbox).getAllByRole('option'),
  }
}

describe('Toolbar direction group', () => {
  it('shows a non-interactive auto label and swaps through the accessible swap control', async () => {
    const user = userEvent.setup()
    const { onSwapDirection } = renderToolbar()

    expect(screen.getByText('自動')).not.toBeInstanceOf(HTMLButtonElement)
    expect(screen.queryByRole('button', { name: '自動検出に戻す' })).toBeNull()
    await user.click(
      screen.getByRole('button', { name: '翻訳方向を入れ替えて固定する' }),
    )
    expect(onSwapDirection).toHaveBeenCalledTimes(1)
  })

  it('releases a fixed direction by pressing the fixed chip', async () => {
    const user = userEvent.setup()
    const { onReleaseFixedDirection } = renderToolbar({
      isDirectionFixed: true,
    })

    await user.click(screen.getByRole('button', { name: '自動検出に戻す' }))
    expect(onReleaseFixedDirection).toHaveBeenCalledTimes(1)
  })
})

describe('Toolbar translation method', () => {
  it('marks the current method pressed and forwards a change', async () => {
    const user = userEvent.setup()
    const { onTranslationMethodChange } = renderToolbar()

    const standard = screen.getByRole('button', { name: '標準翻訳' })
    const idiomatic = screen.getByRole('button', { name: '意訳' })
    expect(standard.getAttribute('aria-pressed')).toBe('true')
    expect(idiomatic.getAttribute('aria-pressed')).toBe('false')

    await user.click(idiomatic)
    expect(onTranslationMethodChange).toHaveBeenCalledTimes(1)
    expect(onTranslationMethodChange).toHaveBeenCalledWith('idiomatic')
  })

  it('ignores a click on the already selected method', async () => {
    const user = userEvent.setup()
    const { onTranslationMethodChange } = renderToolbar()

    await user.click(screen.getByRole('button', { name: '標準翻訳' }))
    expect(onTranslationMethodChange).not.toHaveBeenCalled()
  })
})

describe('Toolbar tone select', () => {
  it('opens a listbox showing all tones with the current one selected', async () => {
    const user = userEvent.setup()
    const { toneTrigger } = renderToolbar({ tone: 'technical' })

    await user.click(toneTrigger)

    const { options } = getToneOptions()
    expect(options).toHaveLength(4)
    expect(
      options.filter(
        (option) => option.getAttribute('aria-selected') === 'true',
      ),
    ).toHaveLength(1)
    expect(options[2]?.getAttribute('aria-selected')).toBe('true')
    expect(options[2]?.textContent).toBe('技術文書')
  })

  it('selects a tone by click and closes the listbox', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar()

    await user.click(toneTrigger)
    const { options } = getToneOptions()
    await user.click(options[1]!)

    expect(onToneChange).toHaveBeenCalledTimes(1)
    expect(onToneChange).toHaveBeenCalledWith('chat' satisfies Tone)
    expect(screen.queryByRole('listbox', { name: '口調' })).toBeNull()
  })

  it('selects the focused tone with the keyboard', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar()

    await user.click(toneTrigger)
    getToneOptions()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onToneChange).toHaveBeenCalledTimes(1)
    expect(onToneChange).toHaveBeenCalledWith('technical' satisfies Tone)
    expect(screen.queryByRole('listbox', { name: '口調' })).toBeNull()
  })

  it('closes with Escape without selecting', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar({ tone: 'casual' })

    await user.click(toneTrigger)
    await user.keyboard('{ArrowUp}{Escape}')

    expect(onToneChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox', { name: '口調' })).toBeNull()
    expect(toneTrigger.textContent).toContain('カジュアル')
  })
})
