// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileSettingsDialog } from './ProfileSettingsDialog'
import type { Profile } from './types'

afterEach(cleanup)

const localProfile: Profile = {
  id: 'local',
  name: 'llama.cpp (ローカル)',
  baseUrl: 'http://127.0.0.1:8080/v1',
  apiKey: '',
  model: '',
  parameters: {
    temperature: 0.7,
    top_p: 0.6,
    top_k: 20,
    repeat_penalty: 1.05,
    provider: { order: ['x'] },
  },
}

function renderDialog(
  overrides: Partial<Parameters<typeof ProfileSettingsDialog>[0]> = {},
) {
  const props: Parameters<typeof ProfileSettingsDialog>[0] = {
    open: true,
    onClose: vi.fn(),
    profiles: [localProfile],
    onProfileAdd: vi.fn(),
    onProfileUpdate: vi.fn(),
    onProfileDelete: vi.fn(),
    ...overrides,
  }

  return { ...render(<ProfileSettingsDialog {...props} />), props }
}

describe('ProfileSettingsDialog', () => {
  it('shows known sampling parameters as fields and the rest as extra JSON when editing', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.click(
      screen.getByRole('button', { name: 'llama.cpp (ローカル) を編集' }),
    )

    expect(screen.getByRole('textbox', { name: 'temperature' })).toHaveProperty(
      'value',
      '0.7',
    )
    expect(screen.getByRole('textbox', { name: 'top_p' })).toHaveProperty(
      'value',
      '0.6',
    )
    expect(screen.getByRole('textbox', { name: 'top_k' })).toHaveProperty(
      'value',
      '20',
    )
    expect(
      screen.getByRole('textbox', { name: 'repeat_penalty' }),
    ).toHaveProperty('value', '1.05')
    const extra = screen.getByRole('textbox', {
      name: '追加パラメータ (JSON)',
    }) as HTMLTextAreaElement
    expect(JSON.parse(extra.value)).toEqual({ provider: { order: ['x'] } })
  })

  it('saves merged parameters from the fields and the extra JSON', async () => {
    const user = userEvent.setup()
    const onProfileUpdate = vi.fn()
    renderDialog({ onProfileUpdate })

    await user.click(
      screen.getByRole('button', { name: 'llama.cpp (ローカル) を編集' }),
    )
    const temperature = screen.getByRole('textbox', { name: 'temperature' })
    await user.clear(temperature)
    await user.type(temperature, '0.3')
    await user.clear(screen.getByRole('textbox', { name: 'top_p' }))
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onProfileUpdate).toHaveBeenCalledTimes(1)
    const [, draft] = onProfileUpdate.mock.calls[0] as [string, Profile]
    expect(draft.parameters).toEqual({
      temperature: 0.3,
      top_k: 20,
      repeat_penalty: 1.05,
      provider: { order: ['x'] },
    })
  })

  it('rejects a non-numeric field, a non-integer top_k, and a field key in the extra JSON', async () => {
    const user = userEvent.setup()
    const onProfileUpdate = vi.fn()
    renderDialog({ onProfileUpdate })

    await user.click(
      screen.getByRole('button', { name: 'llama.cpp (ローカル) を編集' }),
    )
    const temperature = screen.getByRole('textbox', { name: 'temperature' })
    await user.clear(temperature)
    await user.type(temperature, 'abc')
    const topK = screen.getByRole('textbox', { name: 'top_k' })
    await user.clear(topK)
    await user.type(topK, '1.5')
    const extra = screen.getByRole('textbox', { name: '追加パラメータ (JSON)' })
    await user.clear(extra)
    await user.type(extra, '{{"top_p": 1}')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onProfileUpdate).not.toHaveBeenCalled()
    expect(screen.getByText('数値を入力してください')).toBeDefined()
    expect(screen.getByText('整数を入力してください')).toBeDefined()
    expect(
      screen.getByText('top_p は上のフィールドで指定してください'),
    ).toBeDefined()
  })

  it('adds a new profile with empty fields sending no parameters', async () => {
    const user = userEvent.setup()
    const onProfileAdd = vi.fn()
    renderDialog({ onProfileAdd })

    await user.click(screen.getByRole('button', { name: 'プロファイルを追加' }))
    await user.type(screen.getByRole('textbox', { name: '表示名' }), 'OpenAI')
    await user.type(
      screen.getByRole('textbox', { name: 'ベース URL' }),
      'https://api.openai.com/v1',
    )
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onProfileAdd).toHaveBeenCalledTimes(1)
    expect(onProfileAdd.mock.calls[0]?.[0]).toEqual({
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      model: '',
      parameters: {},
    })
  })

  it('duplicates a profile into a prefilled add form and saves it as a new profile', async () => {
    const user = userEvent.setup()
    const onProfileAdd = vi.fn()
    const onProfileUpdate = vi.fn()
    renderDialog({ onProfileAdd, onProfileUpdate })

    await user.click(
      screen.getByRole('button', { name: 'llama.cpp (ローカル) を複製' }),
    )
    expect(screen.getByRole('textbox', { name: '表示名' })).toHaveProperty(
      'value',
      'llama.cpp (ローカル) のコピー',
    )
    expect(screen.getByRole('textbox', { name: 'ベース URL' })).toHaveProperty(
      'value',
      'http://127.0.0.1:8080/v1',
    )
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onProfileUpdate).not.toHaveBeenCalled()
    expect(onProfileAdd).toHaveBeenCalledTimes(1)
    const draft = onProfileAdd.mock.calls[0]?.[0] as Profile
    expect(draft.name).toBe('llama.cpp (ローカル) のコピー')
    expect(draft.parameters).toEqual(localProfile.parameters)
  })

  it('cancelling a duplicate leaves nothing behind', async () => {
    const user = userEvent.setup()
    const onProfileAdd = vi.fn()
    renderDialog({ onProfileAdd })

    await user.click(
      screen.getByRole('button', { name: 'llama.cpp (ローカル) を複製' }),
    )
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(onProfileAdd).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'プロファイルを追加' }),
    ).toBeDefined()
  })
})
