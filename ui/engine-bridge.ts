import { evaluate, aggregate } from '../src/index.js';
import type { LedgerInput, CompoundInput } from '../src/index.js';
import type { LedgerDraft, EngineResult } from './types.js';

/**
 * Turns a LedgerDraft into an EngineResult. Never approximates the engine's
 * own logic (plan.md's Technical Context constraint) — every 'verdict' result
 * here is the literal return value of evaluate()/aggregate().
 */
export function run(draft: LedgerDraft): EngineResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(draft.rawText);
  } catch (err) {
    return { kind: 'parse-error', message: err instanceof Error ? err.message : String(err) };
  }

  const verdict =
    draft.mode === 'evaluate'
      ? evaluate(parsed as LedgerInput)
      : aggregate(
          parsed as CompoundInput,
          draft.previousSubClaims ? { subClaims: draft.previousSubClaims } : undefined,
        );

  if (verdict.refusalReason !== null) {
    return { kind: 'refusal', reason: verdict.refusalReason };
  }
  return { kind: 'verdict', verdict };
}
