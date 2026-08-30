import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { visuallyHidden } from '@mui/utils'
import { TARGET_LANGUAGE_OPTIONS } from './languages'
import { TONE_OPTIONS } from './types'
import type {
  Language,
  SourceLanguage,
  Tone,
  TranslationStatus,
} from './types'
import { BODY_TEXT_SX } from './bodyText'

const COPIED_LABEL_DURATION_MS = 2000

// Announces only translation start/completion milestones (not each streamed
// token). `pending` and `streaming` share the same text so entering
// `streaming` does not trigger a second "started" announcement.
const STATUS_ANNOUNCEMENT: Partial<Record<TranslationStatus, string>> = {
  pending: '翻訳を開始しました',
  streaming: '翻訳を開始しました',
  done: '翻訳が完了しました',
  connectionError: '推論先に接続できません',
  authError: 'API キーが認証されませんでした',
  translationError: '翻訳を完了できませんでした',
  overLimit: '原文が上限を超えています',
}

export function TranslationPane({
  translationStatus,
  translatedText,
  previousTranslatedText,
  inputLimit,
  sourceLanguage,
  targetLanguage,
  onTargetLanguageChange,
  idiomatic,
  onIdiomaticChange,
  tone,
  onToneChange,
  onCopy,
  onRetry,
}: {
  translationStatus: TranslationStatus
  translatedText: string
  previousTranslatedText?: string
  inputLimit: number
  sourceLanguage: SourceLanguage
  targetLanguage: Language
  onTargetLanguageChange: (language: Language) => void
  idiomatic: boolean
  onIdiomaticChange: (idiomatic: boolean) => void
  tone: Tone
  onToneChange: (tone: Tone) => void
  onCopy: () => void | Promise<void>
  onRetry: () => void
}) {
  const [isCopied, setIsCopied] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  useEffect(() => {
    return () => clearTimeout(copyTimeoutRef.current)
  }, [])

  const isTranslating =
    translationStatus === 'pending' || translationStatus === 'streaming'

  const handleCopy = async () => {
    try {
      await onCopy()
    } catch {
      return
    }
    setIsCopied(true)
    clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(
      () => setIsCopied(false),
      COPIED_LABEL_DURATION_MS,
    )
  }

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-label="訳文"
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ height: 4, flexShrink: 0 }}>
        {isTranslating && <LinearProgress sx={{ height: 4 }} />}
      </Box>

      <Stack
        direction="row"
        useFlexGap
        spacing={1}
        sx={{
          alignItems: 'center',
          flexWrap: 'wrap',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="overline" color="text.secondary">
          訳文
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={targetLanguage}
            inputProps={{ 'aria-label': '訳文の言語' }}
            onChange={(event) =>
              onTargetLanguageChange(event.target.value as Language)
            }
          >
            {TARGET_LANGUAGE_OPTIONS.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
                disabled={sourceLanguage === option.value}
              >
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={idiomatic}
              onChange={(event) => onIdiomaticChange(event.target.checked)}
            />
          }
          label="意訳"
          sx={{ m: 0 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="tone-select-label">口調</InputLabel>
          <Select
            labelId="tone-select-label"
            label="口調"
            value={tone}
            onChange={(event) => onToneChange(event.target.value as Tone)}
          >
            {TONE_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={handleCopy}
          disabled={translationStatus !== 'done'}
          sx={{ ml: 'auto' }}
        >
          {isCopied ? 'コピーしました' : 'コピー'}
        </Button>
      </Stack>

      <Box
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, pt: 1.5, pb: 2 }}
      >
        {renderBody({
          translationStatus,
          translatedText,
          previousTranslatedText,
          inputLimit,
          onRetry,
        })}
      </Box>

      <Box
        component="span"
        role="status"
        aria-live="polite"
        sx={visuallyHidden}
      >
        {STATUS_ANNOUNCEMENT[translationStatus] || ''}
      </Box>
    </Paper>
  )
}

function renderBody({
  translationStatus,
  translatedText,
  previousTranslatedText,
  inputLimit,
  onRetry,
}: {
  translationStatus: TranslationStatus
  translatedText: string
  previousTranslatedText?: string
  inputLimit: number
  onRetry: () => void
}) {
  const retryAction = (
    <Button color="inherit" size="small" onClick={onRetry}>
      再試行
    </Button>
  )
  // Matches the source pane's input placeholder: a background hint,
  // not selectable text and not announced to assistive technology.
  const placeholder = (
    <Typography
      aria-hidden
      sx={{ ...BODY_TEXT_SX, color: 'text.disabled', userSelect: 'none' }}
    >
      ここに翻訳結果が表示されます
    </Typography>
  )

  switch (translationStatus) {
    case 'idle':
      return placeholder
    case 'pending':
      return previousTranslatedText ? (
        <Typography sx={{ ...BODY_TEXT_SX, color: 'text.disabled' }}>
          {previousTranslatedText}
        </Typography>
      ) : (
        placeholder
      )
    case 'streaming':
    case 'done':
      return (
        <Typography sx={{ ...BODY_TEXT_SX, color: 'text.primary' }}>
          {translatedText}
        </Typography>
      )
    case 'connectionError':
      return (
        <Alert severity="error" action={retryAction}>
          推論先に接続できません
        </Alert>
      )
    case 'authError':
      return (
        <Alert severity="error" action={retryAction}>
          API キーが認証されませんでした。プロファイル設定を確認してください
        </Alert>
      )
    case 'translationError':
      return (
        <Alert severity="error" action={retryAction}>
          翻訳を完了できませんでした
        </Alert>
      )
    case 'overLimit':
      return (
        <Typography color="error.main">
          原文が {inputLimit.toLocaleString()} 文字を超えています
        </Typography>
      )
  }
}
