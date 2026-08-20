import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import { Header } from './Header'
import { Toolbar } from './Toolbar'
import { SourcePane } from './SourcePane'
import { TranslationPane } from './TranslationPane'
import type { WorkspaceProps } from './types'

/**
 * The single translation workspace screen. Renders the identity row, the
 * toolbar, and the source/translation papers, in the order defined by
 * docs/internal/specs/ui.md.
 *
 * This component owns no translation logic: it only displays the given
 * state and forwards user actions through the provided callbacks.
 */
export function Workspace({
  connectionStatus,
  sourceText,
  sourceLength,
  overLimit,
  inputLimit,
  inputWarnAt,
  onSourceTextChange,
  onClear,
  direction,
  isDirectionFixed,
  onSwapDirection,
  onReleaseFixedDirection,
  translationMethod,
  onTranslationMethodChange,
  tone,
  onToneChange,
  translationStatus,
  translatedText,
  previousTranslatedText,
  onCopy,
  onRetry,
}: WorkspaceProps) {
  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <Header connectionStatus={connectionStatus} />
      <Container
        maxWidth="lg"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          pb: 3,
        }}
      >
        <Toolbar
          direction={direction}
          isDirectionFixed={isDirectionFixed}
          onSwapDirection={onSwapDirection}
          onReleaseFixedDirection={onReleaseFixedDirection}
          translationMethod={translationMethod}
          onTranslationMethodChange={onTranslationMethodChange}
          tone={tone}
          onToneChange={onToneChange}
        />
        <Stack
          component="main"
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          sx={{ flex: 1, minHeight: 0 }}
        >
          <SourcePane
            sourceText={sourceText}
            sourceLength={sourceLength}
            overLimit={overLimit}
            inputLimit={inputLimit}
            inputWarnAt={inputWarnAt}
            onSourceTextChange={onSourceTextChange}
            onClear={onClear}
          />
          <TranslationPane
            translationStatus={translationStatus}
            translatedText={translatedText}
            previousTranslatedText={previousTranslatedText}
            inputLimit={inputLimit}
            onCopy={onCopy}
            onRetry={onRetry}
          />
        </Stack>
      </Container>
    </Box>
  )
}
