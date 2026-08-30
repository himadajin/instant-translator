import { useState } from 'react'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ClearIcon from '@mui/icons-material/Clear'
import UndoIcon from '@mui/icons-material/Undo'
import { BODY_TEXT_SX } from './bodyText'
import { SOURCE_LANGUAGE_OPTIONS } from './languages'
import type { Language, SourceLanguage } from './types'

export function SourcePane({
  sourceText,
  sourceLength,
  overLimit,
  inputLimit,
  inputWarnAt,
  sourceLanguage,
  targetLanguage,
  onSourceLanguageChange,
  onSourceTextChange,
  onClear,
  canRestoreCleared,
  onRestoreCleared,
}: {
  sourceText: string
  sourceLength: number
  overLimit: boolean
  inputLimit: number
  inputWarnAt: number
  sourceLanguage: SourceLanguage
  targetLanguage: Language
  onSourceLanguageChange: (language: SourceLanguage) => void
  onSourceTextChange: (text: string) => void
  onClear: () => void
  canRestoreCleared: boolean
  onRestoreCleared: () => void
}) {
  const [isInputFocused, setIsInputFocused] = useState(false)
  const showCounter = sourceLength > inputWarnAt
  const counterSx = overLimit
    ? { color: 'error.main' }
    : { color: 'warning.main', fontWeight: 500 }

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="原文"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderColor: isInputFocused ? 'primary.main' : undefined,
      }}
    >
      {/* Mirrors the translation pane's 4px progress band so both pane
          headers and bodies start at the same height. */}
      <Box sx={{ height: 4, flexShrink: 0 }} />

      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="overline" color="text.secondary">
          原文
        </Typography>
        <FormControl size="small" sx={{ minWidth: 128 }}>
          <Select
            value={sourceLanguage}
            inputProps={{ 'aria-label': '原文の言語' }}
            onChange={(event) =>
              onSourceLanguageChange(event.target.value as SourceLanguage)
            }
          >
            {SOURCE_LANGUAGE_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
                disabled={option.value === targetLanguage}
              >
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <InputBase
        fullWidth
        multiline
        autoFocus
        value={sourceText}
        onChange={(event) => onSourceTextChange(event.target.value)}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        placeholder="入力すると自動で翻訳します"
        inputProps={{ 'aria-label': '原文' }}
        sx={{
          flex: 1,
          alignItems: 'flex-start',
          overflowY: 'auto',
          px: 2,
          pt: 1.5,
          pb: 1.5,
          ...BODY_TEXT_SX,
          '& .MuiInputBase-input': BODY_TEXT_SX,
        }}
      />

      {/* The toolbar's height comes from the buttons, so the counter appearing
          at the warning threshold does not move the input area. */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: 'center',
          px: 2,
          py: 0.5,
          minHeight: 48,
          borderTop: 1,
          borderColor: 'divider',
          typography: 'caption',
        }}
      >
        {/* Always drawn and disabled when unavailable, so the toolbar keeps
            the same shape whatever the source contains. */}
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="元に戻す">
            <span>
              <IconButton
                size="small"
                aria-label="元に戻す"
                disabled={!canRestoreCleared}
                onClick={onRestoreCleared}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="消去">
            <span>
              <IconButton
                size="small"
                aria-label="消去"
                disabled={sourceLength === 0}
                onClick={onClear}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
        {overLimit && (
          <Typography variant="caption" color="error.main">
            {`原文が ${inputLimit.toLocaleString()} 文字を ${(
              sourceLength - inputLimit
            ).toLocaleString()} 文字超過しています`}
          </Typography>
        )}
        {showCounter && (
          <Typography variant="caption" sx={{ ml: 'auto', ...counterSx }}>
            {sourceLength.toLocaleString()} / {inputLimit.toLocaleString()}
          </Typography>
        )}
      </Stack>
    </Paper>
  )
}
