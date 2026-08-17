const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme',
})

export function countGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length
}
