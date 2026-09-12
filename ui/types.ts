import type { CompoundSubClaim, Verdict } from '../src/index.js';

export type Mode = 'evaluate' | 'aggregate';

export interface LedgerDraft {
  mode: Mode;
  rawText: string;
  /** Only meaningful in aggregate mode, and only once the user has run once (FR-011). */
  previousSubClaims: CompoundSubClaim[] | null;
}

export function emptyDraft(mode: Mode): LedgerDraft {
  return { mode, rawText: '', previousSubClaims: null };
}

export type EngineResult =
  | { kind: 'parse-error'; message: string }
  | { kind: 'refusal'; reason: string }
  | { kind: 'verdict'; verdict: Verdict };
