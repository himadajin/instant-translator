// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsBar } from './SettingsBar'
import type { Tone } from './types'

afterEach(cleanup)

function renderSettings(tone: Tone = 'standard') {
  const onToneChange = vi.fn()

  render(
    <SettingsBar
      translationMethod="standard"
      onTranslationMethodChange={vi.fn()}
      tone={tone}
      onToneChange={onToneChange}
    />,
  )

  return {
    onToneChange,
    toneTrigger: screen.getByRole('button', { name: /TONE/ }),
  }
}

function getToneOptions() {
  const menu = screen.getByRole('menu', { name: '口調' })
  return {
    menu,
    options: within(menu).getAllByRole('menuitemradio'),
  }
}

function expectOneRovingTabStop(options: HTMLElement[], expectedIndex: number) {
  expect(options.filter((option) => option.tabIndex === 0)).toHaveLength(1)
  expect(options[expectedIndex]?.tabIndex).toBe(0)
}

describe('SettingsBar tone menu', () => {
  it('opens through its accessible trigger with menu radio semantics', async () => {
    const user = userEvent.setup()
    const { toneTrigger } = renderSettings('technical')

    expect(toneTrigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')

    await user.click(toneTrigger)

    const { options } = getToneOptions()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('true')
    expect(options).toHaveLength(4)
    expect(
      options.filter(
        (option) => option.getAttribute('aria-checked') === 'true',
      ),
    ).toHaveLength(1)
    expect(options[2]?.getAttribute('aria-checked')).toBe('true')
    expectOneRovingTabStop(options, 2)
    expect(document.activeElement).toBe(options[2])
  })

  it('moves focus with arrows without changing selection or invoking the callback', async () => {
    const user = userEvent.setup()
    const { onToneChange } = renderSettings()

    await user.click(screen.getByRole('button', { name: /TONE/ }))
    const { options } = getToneOptions()

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(options[1])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect(options[1]?.getAttribute('aria-checked')).toBe('false')
    expectOneRovingTabStop(options, 1)
    expect(onToneChange).not.toHaveBeenCalled()

    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(options[2])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect(options[2]?.getAttribute('aria-checked')).toBe('false')
    expectOneRovingTabStop(options, 2)
    expect(onToneChange).not.toHaveBeenCalled()

    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(options[1])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect(options[1]?.getAttribute('aria-checked')).toBe('false')
    expectOneRovingTabStop(options, 1)
    expect(onToneChange).not.toHaveBeenCalled()

    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(options[0])
    expectOneRovingTabStop(options, 0)
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect(onToneChange).not.toHaveBeenCalled()
  })

  it('moves to the first and last option with Home and End', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: /TONE/ }))
    const { options } = getToneOptions()

    await user.keyboard('{End}')
    expect(document.activeElement).toBe(options[3])
    expectOneRovingTabStop(options, 3)

    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(options[0])
    expectOneRovingTabStop(options, 0)
  })

  it('selects the focused tone with Enter, closes, and restores trigger focus', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderSettings()

    await user.click(toneTrigger)
    getToneOptions()
    await user.keyboard('{ArrowDown}{Enter}')

    expect(onToneChange).toHaveBeenCalledTimes(1)
    expect(onToneChange).toHaveBeenCalledWith('chat' satisfies Tone)
    expect(screen.queryByRole('menu', { name: '口調' })).toBeNull()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toneTrigger)
  })

  it('selects the focused tone with Space, closes, and restores trigger focus', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderSettings()

    await user.click(toneTrigger)
    getToneOptions()
    await user.keyboard('{ArrowDown}{ArrowDown} ')

    expect(onToneChange).toHaveBeenCalledTimes(1)
    expect(onToneChange).toHaveBeenCalledWith('technical' satisfies Tone)
    expect(screen.queryByRole('menu', { name: '口調' })).toBeNull()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toneTrigger)
  })

  it('closes with Escape without selecting and restores trigger focus', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderSettings('casual')

    await user.click(toneTrigger)
    await user.keyboard('{ArrowUp}{Escape}')

    expect(onToneChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: '口調' })).toBeNull()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toneTrigger)
    expect(screen.getByRole('button', { name: /カジュアル/ })).toBe(toneTrigger)

    await user.click(toneTrigger)
    const { menu, options } = getToneOptions()
    const casualOption = within(menu).getByRole('menuitemradio', {
      name: 'カジュアル',
    })
    expect(casualOption.getAttribute('aria-checked')).toBe('true')
    expectOneRovingTabStop(options, 3)
    expect(document.activeElement).toBe(casualOption)
  })
})
