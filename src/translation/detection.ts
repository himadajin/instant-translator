import type { DetectedLanguage } from './types'

// 字母が 3 未満では一語・記号と区別できず判定が不安定なため曖昧とする。
const MIN_LETTERS = 3
// 双方 3 文字以上あれば混在とみなし、多数決で方向を切り替えない。
const MIN_EACH_FOR_MIXED = 3

const JAPANESE_CHAR = /\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Han}/u
const LATIN_CHAR = /\p{Script=Latin}/u

export function detectLanguage(source: string): DetectedLanguage {
  let japanese = 0
  let latin = 0

  for (const char of source) {
    if (JAPANESE_CHAR.test(char)) {
      japanese += 1
    } else if (LATIN_CHAR.test(char)) {
      latin += 1
    }
  }

  if (japanese + latin < MIN_LETTERS) {
    return 'ambiguous'
  }
  if (japanese >= MIN_EACH_FOR_MIXED && latin >= MIN_EACH_FOR_MIXED) {
    return 'ambiguous'
  }
  if (japanese > latin) {
    return 'japanese'
  }
  if (latin > japanese) {
    return 'english'
  }
  return 'ambiguous'
}
