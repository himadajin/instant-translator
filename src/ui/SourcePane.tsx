import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputBase from '@mui/material/InputBase'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
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
}) {
  const [isInputFocused, setIsInputFocused] = useState(false)
  const counterSx = overLimit
    ? { color: 'error.main' }
    : sourceLength > inputWarnAt
      ? { color: 'warning.main', fontWeight: 500 }
      : { color: 'text.secondary' }

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
        <Button
          size="small"
          onClick={onClear}
          disabled={sourceLength === 0}
          sx={{ ml: 'auto' }}
        >
          消去
        </Button>
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
          ...BODY_TEXT_SX,
          '& .MuiInputBase-input': BODY_TEXT_SX,
        }}
      />

      <Stack
        direction="row"
        spacing={2}
        sx={{
          alignItems: 'baseline',
          justifyContent: 'space-between',
          px: 2,
          pb: 1.5,
        }}
      >
        <Typography variant="caption" color="error.main">
          {overLimit
            ? `原文が ${inputLimit.toLocaleString()} 文字を ${(
                sourceLength - inputLimit
              ).toLocaleString()} 文字超過しています`
            : ''}
        </Typography>
        <Typography variant="caption" sx={counterSx}>
          {sourceLength.toLocaleString()} / {inputLimit.toLocaleString()}
        </Typography>
      </Stack>
    </Paper>
  )
}
