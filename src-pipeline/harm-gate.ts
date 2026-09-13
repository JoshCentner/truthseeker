import type { LlmClient } from './llm-client.js';
import type { HarmGateResult, ReviewQueueEntry } from './types.js';
import { appendJsonLine, REVIEW_QUEUE_FILE } from './storage.js';
import { remediate, type RemediationResult } from './remediate.js';

/**
 * FR-001-002a: the pre-flight classifier. This is the ONLY function
 * run-pipeline.ts calls before any other step — see FR-006's hard-stop
 * requirement, enforced in run-pipeline.ts by simply not calling anything
 * else when the outcome isn't 'accept'.
 */
const HARM_GATE_PROMPT = (claim: string, violation?: string): string => {
  const base = `You are a pre-flight classifier for a fact-checking platform. Classify the claim below
against exactly these rules, per the platform's decided intake policy:

REJECT if the claim:
- names a private individual and targets their private life
- is not falsifiable-shaped (no observation could in principle show it false)

ACCEPT if the claim is about:
- a public figure's conduct in their public role
- an institution, product, or policy
- a scientific, historical, or statistical question

NEEDS_REVIEW if you are genuinely uncertain — a real borderline case, not a confident match to
either rule above (e.g. whether someone counts as a public figure, or whether specific conduct
falls inside their public role). This is a POLICY judgment call, distinct from being unable to
produce valid output — if you can classify it (even as uncertain), do so; only use this for
genuine borderline cases.

Claim: ${JSON.stringify(claim)}

Respond with exactly one JSON object, no other text:
{"outcome": "accept"} or
{"outcome": "reject", "rule": "<specific rule that fired, in your own words>"} or
{"outcome": "needs_review", "reason": "<specific reason for the uncertainty>"}`;
  return violation
    ? `${base}\n\nYour previous response was invalid: ${violation}\nRespond again, correcting exactly that issue.`
    : base;
};

interface RawHarmGateResponse {
  outcome: 'accept' | 'reject' | 'needs_review';
  rule?: string;
  reason?: string;
}

/**
 * FR-040, FR-045 (amendment): a mechanical shape failure (missing outcome,
 * or a reject/needs_review with no rule/reason) is a validation failure that
 * triggers remediation — distinct from the classifier legitimately choosing
 * 'needs_review' as a policy judgment, which is not an error at all.
 */
function validateHarmGateResponse(raw: unknown): { ok: true; value: RawHarmGateResponse } | { ok: false; violation: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, violation: 'response was not a JSON object' };
  }
  const r = raw as Partial<RawHarmGateResponse>;
  if (r.outcome !== 'accept' && r.outcome !== 'reject' && r.outcome !== 'needs_review') {
    return { ok: false, violation: '"outcome" must be exactly one of "accept", "reject", or "needs_review"' };
  }
  if (r.outcome === 'reject' && (typeof r.rule !== 'string' || r.rule.trim().length === 0)) {
    return { ok: false, violation: 'outcome "reject" requires a non-empty "rule" naming which rule fired (FR-005)' };
  }
  if (r.outcome === 'needs_review' && (typeof r.reason !== 'string' || r.reason.trim().length === 0)) {
    return { ok: false, violation: 'outcome "needs_review" requires a non-empty "reason" for the uncertainty' };
  }
  return { ok: true, value: r as RawHarmGateResponse };
}

export async function runHarmGate(claim: string, llm: LlmClient, runId: string): Promise<RemediationResult<HarmGateResult>> {
  const result = await remediate('harm-gate', llm, (violation) => HARM_GATE_PROMPT(claim, violation), validateHarmGateResponse);
  if (!result.ok) {
    // FR-044: a mechanical shape failure after exhausting attempts is a
    // clarifying-question case, not the same thing as a genuine
    // needs_review policy judgment (research.md §10) — run-pipeline.ts
    // turns this into PipelineResult.kind: 'needs_clarification'.
    return result;
  }

  const raw = result.value;
  const outcome: HarmGateResult =
    raw.outcome === 'accept'
      ? { outcome: 'accept' }
      : raw.outcome === 'reject'
        ? { outcome: 'reject', rule: raw.rule as string }
        : { outcome: 'needs_review', reason: raw.reason as string };

  if (outcome.outcome === 'needs_review') {
    const entry: ReviewQueueEntry = {
      runId,
      claimText: claim,
      reason: outcome.reason,
      queuedAt: new Date().toISOString(),
    };
    await appendJsonLine(REVIEW_QUEUE_FILE, entry);
  }

  return { ok: true, value: outcome, attempts: result.attempts };
}
