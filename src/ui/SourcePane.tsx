import { useState } from 'react'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputBase from '@mui/material/InputBase'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BODY_TEXT_SX } from './bodyText'
import { LANGUAGE_NAMES, SOURCE_LANGUAGE_OPTIONS } from './languages'
import type { DetectedLanguage, Language, SourceLanguage } from './types'

export function SourcePane({
  sourceText,
  sourceLength,
  overLimit,
  inputLimit,
  inputWarnAt,
  sourceLanguage,
  targetLanguage,
  detectedLanguage,
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
  detectedLanguage: DetectedLanguage
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
        p: 2,
        borderColor: isInputFocused ? 'primary.main' : undefined,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
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

      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minHeight: 44, display: 'flex', alignItems: 'center', ml: 6 }}
      >
        {sourceLanguage === 'auto' &&
        detectedLanguage !== 'ambiguous' &&
        sourceLength > 0
          ? `${LANGUAGE_NAMES[detectedLanguage]} を検出`
          : ''}
      </Typography>

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
          ...BODY_TEXT_SX,
          '& .MuiInputBase-input': BODY_TEXT_SX,
        }}
      />

      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'baseline', justifyContent: 'space-between' }}
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
