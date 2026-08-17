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
  const targetLanguage = input.direction === 'ja-to-en' ? 'English' : 'Japanese'

  const style = [
    methodStyle(input.method, targetLanguage),
    toneStyle(input.tone),
  ].join('; ')

  const instruction = [
    `Please translate the following text into ${targetLanguage}.`,
    `Note that the translation style must strictly conform to [${style}].`,
    'Only output the translated result without any additional explanation.',
    'Do not add facts, claims, emotions, or proper nouns that are not in the source.',
  ].join(' ')

  return [{ role: 'user', content: `${instruction}\n\n${input.source}` }]
}

function methodStyle(
  method: TranslationMethod,
  targetLanguage: string,
): string {
  switch (method) {
    case 'standard':
      return `natural ${targetLanguage} that preserves the source's meaning, information, and nuance`
    case 'idiomatic':
      return `polished ${targetLanguage} that keeps the author's intent and factual relations while turning incomplete or messy wording into well-formed writing`
  }
}

function toneStyle(tone: Tone): string {
  switch (tone) {
    case 'standard':
      return "the source's own tone preserved"
    case 'chat':
      return 'concise, natural workplace-chat wording suitable for Slack or Teams, never rude'
    case 'technical':
      return 'technical terms, code, identifiers, and Markdown structure kept intact, worded clearly and consistently'
    case 'casual':
      return 'friendly wording suitable for a friend or social media, with no slang or emotion that is not in the source'
  }
}
