import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import { Header } from './Header'
import { SourcePane } from './SourcePane'
import { TranslationPane } from './TranslationPane'
import type { WorkspaceProps } from './types'

/**
 * The single translation workspace screen. Renders the identity row, the
 * source/translation papers in the order defined by
 * docs/internal/specs/ui.md.
 *
 * This component owns no translation logic: it only displays the given
 * state and forwards user actions through the provided callbacks.
 */
export function Workspace({
  connectionStatus,
  profiles,
  selectedProfileId,
  onProfileSelect,
  onProfileAdd,
  onProfileUpdate,
  onProfileDelete,
  sourceText,
  sourceLength,
  overLimit,
  inputLimit,
  inputWarnAt,
  onSourceTextChange,
  onClear,
  canRestoreCleared,
  onRestoreCleared,
  sourceLanguage,
  targetLanguage,
  onSourceLanguageChange,
  onTargetLanguageChange,
  idiomatic,
  onIdiomaticChange,
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
      <Header
        connectionStatus={connectionStatus}
        profiles={profiles}
        selectedProfileId={selectedProfileId}
        onProfileSelect={onProfileSelect}
        onProfileAdd={onProfileAdd}
        onProfileUpdate={onProfileUpdate}
        onProfileDelete={onProfileDelete}
      />
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
        <Stack
          component="main"
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          sx={{ flex: 1, minHeight: 0, pt: 2 }}
        >
          <SourcePane
            sourceText={sourceText}
            sourceLength={sourceLength}
            overLimit={overLimit}
            inputLimit={inputLimit}
            inputWarnAt={inputWarnAt}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            onSourceLanguageChange={onSourceLanguageChange}
            onSourceTextChange={onSourceTextChange}
            onClear={onClear}
            canRestoreCleared={canRestoreCleared}
            onRestoreCleared={onRestoreCleared}
          />
          <TranslationPane
            translationStatus={translationStatus}
            translatedText={translatedText}
            previousTranslatedText={previousTranslatedText}
            inputLimit={inputLimit}
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            onTargetLanguageChange={onTargetLanguageChange}
            idiomatic={idiomatic}
            onIdiomaticChange={onIdiomaticChange}
            tone={tone}
            onToneChange={onToneChange}
            onCopy={onCopy}
            onRetry={onRetry}
          />
        </Stack>
      </Container>
    </Box>
  )
}
