// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Header } from './Header'
import type { ConnectionStatus } from './types'

afterEach(cleanup)

function renderHeader(connectionStatus: ConnectionStatus) {
  return render(
    <Header
      connectionStatus={connectionStatus}
      profiles={[]}
      selectedProfileId=""
      onProfileSelect={vi.fn()}
      onProfileAdd={vi.fn()}
      onProfileUpdate={vi.fn()}
      onProfileDelete={vi.fn()}
    />,
  )
}

describe('Header', () => {
  it('shows no connection status while the connection is healthy', () => {
    for (const status of ['ready', 'checking'] as const) {
      renderHeader(status)
      expect(screen.queryByRole('status')).toBeNull()
      cleanup()
    }
  })

  it('shows an error chip when the inference target is unreachable', () => {
    renderHeader('unavailable')

    expect(screen.getByRole('status').textContent).toBe('未接続')
  })

  it('shows an error chip when the API key is rejected', () => {
    renderHeader('auth-failed')

    expect(screen.getByRole('status').textContent).toBe('認証エラー')
  })
})
