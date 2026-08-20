import { useEffect, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { visuallyHidden } from '@mui/utils'
import type { TranslationStatus } from './types'
import { BODY_TEXT_SX } from './bodyText'

const COPIED_LABEL_DURATION_MS = 2000

// Announces only translation start/completion milestones (not each streamed
// token). `pending` and `streaming` share the same text so entering
// `streaming` does not trigger a second "started" announcement.
const STATUS_ANNOUNCEMENT: Partial<Record<TranslationStatus, string>> = {
  pending: '翻訳を開始しました',
  streaming: '翻訳を開始しました',
  done: '翻訳が完了しました',
  connectionError: 'ローカル翻訳に接続できません',
  translationError: '翻訳を完了できませんでした',
  overLimit: '原文が上限を超えています',
}

export function TranslationPane({
  translationStatus,
  translatedText,
  previousTranslatedText,
  inputLimit,
  onCopy,
  onRetry,
}: {
  translationStatus: TranslationStatus
  translatedText: string
  previousTranslatedText?: string
  inputLimit: number
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
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          pt: 2,
        }}
      >
        <Typography variant="overline" color="text.secondary">
          訳文
        </Typography>
        <Button
          size="small"
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={handleCopy}
          disabled={translationStatus !== 'done'}
        >
          {isCopied ? 'コピーしました' : 'コピー'}
        </Button>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, pb: 2 }}>
        {renderBody({
          translationStatus,
          translatedText,
          previousTranslatedText,
          inputLimit,
          onRetry,
        })}
      </Box>

      <Box component="span" role="status" aria-live="polite" sx={visuallyHidden}>
        {STATUS_ANNOUNCEMENT[translationStatus] ?? ''}
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

  switch (translationStatus) {
    case 'idle':
      return <Typography color="text.secondary">翻訳結果</Typography>
    case 'pending':
      return previousTranslatedText ? (
        <Typography sx={{ ...BODY_TEXT_SX, color: 'text.disabled' }}>
          {previousTranslatedText}
        </Typography>
      ) : (
        <Typography color="text.secondary">翻訳結果</Typography>
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
          ローカル翻訳に接続できません
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
