import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BODY_TEXT_SX } from './bodyText'

export function SourcePane({
  sourceText,
  sourceLength,
  overLimit,
  inputLimit,
  inputWarnAt,
  onSourceTextChange,
  onClear,
}: {
  sourceText: string
  sourceLength: number
  overLimit: boolean
  inputLimit: number
  inputWarnAt: number
  onSourceTextChange: (text: string) => void
  onClear: () => void
}) {
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
        '&:focus-within': { borderColor: 'primary.main' },
      }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="overline" color="text.secondary">
          原文
        </Typography>
        <Button size="small" onClick={onClear} disabled={sourceLength === 0}>
          消去
        </Button>
      </Stack>

      <InputBase
        fullWidth
        multiline
        autoFocus
        value={sourceText}
        onChange={(event) => onSourceTextChange(event.target.value)}
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
