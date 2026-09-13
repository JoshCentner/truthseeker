import type { LlmClient } from './llm-client.js';
import type { HarmGateResult, ReviewQueueEntry } from './types.js';
import { appendJsonLine, REVIEW_QUEUE_FILE } from './storage.js';

/**
 * FR-001-002a: the pre-flight classifier. This is the ONLY function
 * run-pipeline.ts calls before any other step — see FR-006's hard-stop
 * requirement, enforced in run-pipeline.ts by simply not calling anything
 * else when the outcome isn't 'accept'.
 */
const HARM_GATE_PROMPT = (claim: string): string => `You are a pre-flight classifier for a fact-checking platform. Classify the claim below
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
falls inside their public role).

Claim: ${JSON.stringify(claim)}

Respond with exactly one JSON object, no other text:
{"outcome": "accept"} or
{"outcome": "reject", "rule": "<specific rule that fired, in your own words>"} or
{"outcome": "needs_review", "reason": "<specific reason for the uncertainty>"}`;

interface RawHarmGateResponse {
  outcome: 'accept' | 'reject' | 'needs_review';
  rule?: string;
  reason?: string;
}

function parseHarmGateResponse(text: string): HarmGateResult {
  let parsed: RawHarmGateResponse;
  try {
    // Models sometimes wrap JSON in a code fence despite instructions; strip it defensively.
    const cleaned = text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
    parsed = JSON.parse(cleaned);
  } catch {
    // FR-005: never a generic message — a parse failure is itself a specific, named reason.
    return { outcome: 'needs_review', reason: `harm-gate classifier returned unparseable output: ${text.slice(0, 200)}` };
  }

  if (parsed.outcome === 'accept') {
    return { outcome: 'accept' };
  }
  if (parsed.outcome === 'reject') {
    return { outcome: 'reject', rule: parsed.rule ?? 'unnamed rule (classifier omitted one — treated as a defect, not a valid rejection)' };
  }
  return { outcome: 'needs_review', reason: parsed.reason ?? 'classifier reported uncertainty without a stated reason' };
}

export async function runHarmGate(claim: string, llm: LlmClient, runId: string): Promise<HarmGateResult> {
  const response = await llm.generate(HARM_GATE_PROMPT(claim));
  const result = parseHarmGateResponse(response.text);

  if (result.outcome === 'needs_review') {
    const entry: ReviewQueueEntry = {
      runId,
      claimText: claim,
      reason: result.reason,
      queuedAt: new Date().toISOString(),
    };
    await appendJsonLine(REVIEW_QUEUE_FILE, entry);
  }

  return result;
}
