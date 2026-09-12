import type { Band } from './ledger.js';

/**
 * Ordinal used ONLY for "pick the lower/minimum band" comparisons (FR-030's
 * dual-tree routing, FR-035's minimum-of-load-bearing aggregation). This is a
 * documented scope simplification: the protocol does not define a single
 * scale across all eight Band values — Unsupported and Refuted, for instance,
 * are qualitatively different findings (a burden finding vs. a falsity
 * finding), not comparably "higher/lower". Weakest first.
 */
export const BAND_ORDER_WEAKEST_FIRST: Band[] = [
  'unfalsifiable',
  'unresolvable',
  'refuted',
  'unsupported',
  'contested',
  'doubtful',
  'probable',
  'established',
];

export function bandRank(band: Band | null): number {
  if (band === null) return -1;
  return BAND_ORDER_WEAKEST_FIRST.indexOf(band);
}

export function lowerBand(a: Band, b: Band): Band {
  return bandRank(a) <= bandRank(b) ? a : b;
}

export function stepDownBand(band: Band): Band {
  const i = BAND_ORDER_WEAKEST_FIRST.indexOf(band);
  if (i <= 0) return band;
  return BAND_ORDER_WEAKEST_FIRST[i - 1] as Band;
}
