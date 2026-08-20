import AppBar from '@mui/material/AppBar'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { useColorScheme } from '@mui/material/styles'
import type { ConnectionStatus } from './types'

const STATUS_CHIP: Record<
  ConnectionStatus,
  { label: string; color: 'default' | 'error' }
> = {
  ready: { label: 'ローカル: 接続済み', color: 'default' },
  checking: { label: 'ローカル: 確認中', color: 'default' },
  unavailable: { label: 'ローカル: 未接続', color: 'error' },
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
}: {
  connectionStatus: ConnectionStatus
}) {
  const status = STATUS_CHIP[connectionStatus]

  return (
    <AppBar position="static" color="default" elevation={0}>
      <Container maxWidth="lg" disableGutters>
        <Toolbar>
          <Typography variant="h6" component="h1" sx={{ fontWeight: 500 }}>
            Instant Translator
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', ml: 'auto' }}
          >
            <Chip
              size="small"
              variant="outlined"
              color={status.color}
              label={status.label}
              role="status"
              aria-live="polite"
            />
            <ColorModeToggle />
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  )
}
