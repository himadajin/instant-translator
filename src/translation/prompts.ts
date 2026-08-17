import type {
  ChatMessage,
  Tone,
  TranslationDirection,
  TranslationMethod,
} from './types'

export function buildMessages(input: {
  source: string
  direction: TranslationDirection
  method: TranslationMethod
  tone: Tone
}): ChatMessage[] {
  const sourceLanguage = input.direction === 'ja-to-en' ? 'Japanese' : 'English'
  const targetLanguage = input.direction === 'ja-to-en' ? 'English' : 'Japanese'

  const methodLine =
    input.method === 'standard'
      ? `Translate so that meaning, information, and nuance are preserved, as natural ${targetLanguage}.`
      : `Translate adaptively: keep the author's intent and factual relations, and turn incomplete or messy wording into polished ${targetLanguage} suited to the purpose.`

  const toneLine = toneInstruction(input.tone)

  const system = [
    `You are a translator from ${sourceLanguage} to ${targetLanguage}.`,
    'The translation direction is already decided. Do not detect or guess the language.',
    methodLine,
    toneLine,
    'Output only the translation. Do not add a preamble, explanation, quotation marks, candidate list, or mode name.',
    'Do not add facts, claims, emotions, or proper nouns that are not in the source.',
  ].join(' ')

  return [
    { role: 'system', content: system },
    { role: 'user', content: input.source },
  ]
}

function toneInstruction(tone: Tone): string {
  switch (tone) {
    case 'standard':
      return 'Preserve the source tone as much as possible.'
    case 'chat':
      return 'Write concise, natural wording suitable for short workplace chat such as Slack or Teams, without being rude.'
    case 'technical':
      return 'Keep technical terms, code, identifiers, and Markdown structure whenever possible. Write clearly and consistently.'
    case 'casual':
      return 'Write in a friendly way suitable for talking with a friend or posting on social media. Do not add slang or emotion that is not in the source.'
  }
}
