import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import SettingsIcon from '@mui/icons-material/Settings'
import { useColorScheme } from '@mui/material/styles'
import { ProfileSettingsDialog } from './ProfileSettingsDialog'
import type { ConnectionStatus, Profile, ProfileDraft } from './types'

const STATUS_CHIP: Record<
  ConnectionStatus,
  { label: string; color: 'default' | 'error' }
> = {
  ready: { label: '接続済み', color: 'default' },
  checking: { label: '確認中', color: 'default' },
  unavailable: { label: '未接続', color: 'error' },
  'auth-failed': { label: '認証エラー', color: 'error' },
}

function ColorModeToggle() {
  const { mode, systemMode, setMode } = useColorScheme()
  const resolvedMode = mode === 'system' ? systemMode : mode
  const isDark = resolvedMode === 'dark'

  return (
    <IconButton
      aria-label={
        isDark ? 'ライトモードに切り替える' : 'ダークモードに切り替える'
      }
      onClick={() => setMode(isDark ? 'light' : 'dark')}
    >
      {isDark ? <LightModeIcon /> : <DarkModeIcon />}
    </IconButton>
  )
}

export function Header({
  connectionStatus,
  profiles,
  selectedProfileId,
  onProfileSelect,
  onProfileAdd,
  onProfileUpdate,
  onProfileDelete,
}: {
  connectionStatus: ConnectionStatus
  profiles: readonly Profile[]
  selectedProfileId: string
  onProfileSelect: (id: string) => void
  onProfileAdd: (draft: ProfileDraft) => void
  onProfileUpdate: (id: string, draft: ProfileDraft) => void
  onProfileDelete: (id: string) => void
}) {
  const status = STATUS_CHIP[connectionStatus]
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <AppBar position="static" color="default" elevation={0}>
      <Container maxWidth="lg" disableGutters>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 500 }}>
            Instant Translator
          </Typography>
          <Stack
            direction="row"
            spacing={3}
            sx={{ alignItems: 'center', ml: 'auto' }}
          >
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              {profiles.length > 0 && (
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <Select
                    value={selectedProfileId}
                    inputProps={{ 'aria-label': 'プロファイル' }}
                    onChange={(event) => onProfileSelect(event.target.value)}
                  >
                    {profiles.map((profile) => (
                      <MenuItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <IconButton
                aria-label="プロファイル設定を開く"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon />
              </IconButton>
              <Chip
                size="small"
                variant="outlined"
                color={status.color}
                label={status.label}
                role="status"
                aria-live="polite"
              />
            </Stack>
            <ColorModeToggle />
          </Stack>
        </Toolbar>
      </Container>
      <ProfileSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profiles={profiles}
        onProfileAdd={onProfileAdd}
        onProfileUpdate={onProfileUpdate}
        onProfileDelete={onProfileDelete}
      />
    </AppBar>
  )
}
