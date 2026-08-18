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

  render(
    <Toolbar
      direction="jaToEn"
      isDirectionFixed={isDirectionFixed}
      onSwapDirection={onSwapDirection}
      onReleaseFixedDirection={onReleaseFixedDirection}
      translationMethod="standard"
      onTranslationMethodChange={vi.fn()}
      tone={tone}
      onToneChange={onToneChange}
    />,
  )

  return {
    onToneChange,
    onSwapDirection,
    onReleaseFixedDirection,
    toneTrigger: screen.getByRole('button', { name: /TONE/ }),
  }
}

function getToneOptions() {
  const menu = screen.getByRole('menu', { name: 'TONE' })
  return {
    menu,
    options: within(menu).getAllByRole('menuitemradio'),
  }
}

describe('Toolbar direction group', () => {
  it('swaps the direction through the accessible swap control', async () => {
    const user = userEvent.setup()
    const { onSwapDirection } = renderToolbar()

    expect(screen.getByText('AUTO')).not.toBeInstanceOf(HTMLButtonElement)
    await user.click(
      screen.getByRole('button', { name: '翻訳方向を入れ替えて固定する' }),
    )
    expect(onSwapDirection).toHaveBeenCalledTimes(1)
  })

  it('releases a fixed direction by pressing FIXED', async () => {
    const user = userEvent.setup()
    const { onReleaseFixedDirection } = renderToolbar({
      isDirectionFixed: true,
    })

    await user.click(screen.getByRole('button', { name: /FIXED/ }))
    expect(onReleaseFixedDirection).toHaveBeenCalledTimes(1)
  })
})

describe('Toolbar tone menu', () => {
  it('opens through its accessible trigger with menu radio semantics', async () => {
    const user = userEvent.setup()
    const { toneTrigger } = renderToolbar({ tone: 'technical' })

    expect(toneTrigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')

    await user.click(toneTrigger)

    const { menu, options } = getToneOptions()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('true')
    expect(options).toHaveLength(4)
    expect(
      options.filter(
        (option) => option.getAttribute('aria-checked') === 'true',
      ),
    ).toHaveLength(1)
    expect(options[2]?.getAttribute('aria-checked')).toBe('true')
    expect(menu.contains(document.activeElement)).toBe(true)
  })

  it('moves focus with arrows without changing selection or invoking the callback', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar()

    await user.click(toneTrigger)
    const { options } = getToneOptions()

    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(document.activeElement).toBe(options[1])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect(options[1]?.getAttribute('aria-checked')).toBe('false')
    expect(onToneChange).not.toHaveBeenCalled()

    await user.keyboard('{ArrowUp}')
    expect(document.activeElement).toBe(options[0])
    expect(options[0]?.getAttribute('aria-checked')).toBe('true')
    expect(onToneChange).not.toHaveBeenCalled()
  })

  it('moves to the first and last option with Home and End', async () => {
    const user = userEvent.setup()
    const { toneTrigger } = renderToolbar()

    await user.click(toneTrigger)
    const { options } = getToneOptions()

    await user.keyboard('{ArrowDown}{End}')
    expect(document.activeElement).toBe(options[3])

    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(options[0])
  })

  it('selects the focused tone with Enter, closes, and restores trigger focus', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar()

    await user.click(toneTrigger)
    getToneOptions()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onToneChange).toHaveBeenCalledTimes(1)
    expect(onToneChange).toHaveBeenCalledWith('chat' satisfies Tone)
    expect(screen.queryByRole('menu', { name: 'TONE' })).toBeNull()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toneTrigger)
  })

  it('selects the focused tone with Space, closes, and restores trigger focus', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar()

    await user.click(toneTrigger)
    getToneOptions()
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown} ')

    expect(onToneChange).toHaveBeenCalledTimes(1)
    expect(onToneChange).toHaveBeenCalledWith('technical' satisfies Tone)
    expect(screen.queryByRole('menu', { name: 'TONE' })).toBeNull()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toneTrigger)
  })

  it('closes with Escape without selecting and restores trigger focus', async () => {
    const user = userEvent.setup()
    const { onToneChange, toneTrigger } = renderToolbar({ tone: 'casual' })

    await user.click(toneTrigger)
    await user.keyboard('{ArrowUp}{Escape}')

    expect(onToneChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('menu', { name: 'TONE' })).toBeNull()
    expect(toneTrigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(toneTrigger)
    expect(screen.getByRole('button', { name: /カジュアル/ })).toBe(toneTrigger)

    await user.click(toneTrigger)
    const { menu } = getToneOptions()
    const casualOption = within(menu).getByRole('menuitemradio', {
      name: 'カジュアル',
    })
    expect(casualOption.getAttribute('aria-checked')).toBe('true')
    expect(menu.contains(document.activeElement)).toBe(true)
  })
})
