import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import {
  TONE_OPTIONS,
  type Tone,
  type TranslationDirection,
  type TranslationMethod,
} from './types'

const LANGUAGE_NAMES: Record<
  TranslationDirection,
  { source: string; target: string }
> = {
  jaToEn: { source: '日本語', target: 'English' },
  enToJa: { source: 'English', target: '日本語' },
}

export function Toolbar({
  direction,
  isDirectionFixed,
  onSwapDirection,
  onReleaseFixedDirection,
  translationMethod,
  onTranslationMethodChange,
  tone,
  onToneChange,
}: {
  direction: TranslationDirection
  isDirectionFixed: boolean
  onSwapDirection: () => void
  onReleaseFixedDirection: () => void
  translationMethod: TranslationMethod
  onTranslationMethodChange: (method: TranslationMethod) => void
  tone: Tone
  onToneChange: (tone: Tone) => void
}) {
  const { source, target } = LANGUAGE_NAMES[direction]

  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={2}
      sx={{
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        {isDirectionFixed ? (
          <Chip
            size="small"
            label="固定"
            onClick={onReleaseFixedDirection}
            aria-label="自動検出に戻す"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            自動
          </Typography>
        )}
        <Typography variant="body2">{source}</Typography>
        <IconButton
          size="small"
          aria-label="翻訳方向を入れ替えて固定する"
          onClick={onSwapDirection}
        >
          <SwapHorizIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2">{target}</Typography>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={translationMethod}
          onChange={(_event, value: TranslationMethod | null) => {
            if (value !== null) {
              onTranslationMethodChange(value)
            }
          }}
        >
          <ToggleButton value="standard">標準翻訳</ToggleButton>
          <ToggleButton value="idiomatic">意訳</ToggleButton>
        </ToggleButtonGroup>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="tone-select-label">口調</InputLabel>
          <Select
            labelId="tone-select-label"
            label="口調"
            value={tone}
            onChange={(event) => onToneChange(event.target.value)}
          >
            {TONE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>
    </Stack>
  )
}
