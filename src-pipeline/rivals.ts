import type { LlmClient } from './llm-client.js';
import type { RivalHypothesis } from './types.js';
import type { Rival } from '../src/index.js';
import { remediate, type RemediationResult } from './remediate.js';

/**
 * FR-028, FR-029: model reasoning MAY generate a hypothesis to test — it MUST
 * NOT serve as evidence in its own right (Constitution Principle II). The
 * "hypothesis, not evidence" framing is structural, not just a comment: this
 * function's return type is RivalHypothesis, never anything that could be
 * mistaken for a GradingOutput or fed into gradeOrigin/assembleLedger's
 * origin-grading paths — a rival only ever becomes an input to
 * markDiagnosticity, never to grading.
 */
const RIVALS_PROMPT = (claim: string, violation?: string): string => {
  const base = `Propose at least one genuinely plausible alternative explanation for this claim — a real
competing account a thoughtful skeptic might raise, not a strawman.

Claim: ${JSON.stringify(claim)}

For each rival, also judge whether it seems more plausible than the claim itself, or less/equally
plausible, based on general reasoning alone (this is a hypothesis to test against the evidence,
not a conclusion — the evidence itself is graded separately and blind to this).

Respond with exactly one JSON object, no other text:
{ "rivals": [ { "description": "<the alternative explanation>", "plausibilityRelativeToClaim": "more_plausible" | "less_or_equally_plausible" } ] }`;
  return violation
    ? `${base}\n\nYour previous response was invalid: ${violation}\nRespond again, correcting exactly that issue.`
    : base;
};

interface RawRivalsResponse {
  rivals: { description: string; plausibilityRelativeToClaim: Rival['plausibilityRelativeToClaim'] }[];
}

const VALID_PLAUSIBILITY: Rival['plausibilityRelativeToClaim'][] = ['more_plausible', 'less_or_equally_plausible'];

/** FR-028, FR-040 (amendment): at least one rival is required — previously
 * unchecked, so an empty array would have silently satisfied FR-028's "MUST
 * propose at least one" without anyone noticing. */
function validateRivals(raw: unknown): { ok: true; value: RawRivalsResponse } | { ok: false; violation: string } {
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as Partial<RawRivalsResponse>).rivals)) {
    return { ok: false, violation: 'response must be an object with a "rivals" array' };
  }
  const rivals = (raw as RawRivalsResponse).rivals;
  if (rivals.length === 0) {
    return { ok: false, violation: 'FR-028 requires at least one rival — the array was empty' };
  }
  for (const r of rivals) {
    if (typeof r.description !== 'string' || r.description.trim().length === 0) {
      return { ok: false, violation: 'every rival needs a non-empty "description"' };
    }
    if (!VALID_PLAUSIBILITY.includes(r.plausibilityRelativeToClaim)) {
      return { ok: false, violation: `"plausibilityRelativeToClaim" must be one of ${VALID_PLAUSIBILITY.join(', ')}` };
    }
  }
  return { ok: true, value: raw as RawRivalsResponse };
}

export async function generateRivals(claim: string, llm: LlmClient): Promise<RemediationResult<RivalHypothesis[]>> {
  const result = await remediate('rivals', llm, (violation) => RIVALS_PROMPT(claim, violation), validateRivals);
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    attempts: result.attempts,
    value: result.value.rivals.map((r, i) => ({
      id: `rival-${i}`,
      description: r.description,
      plausibilityRelativeToClaim: r.plausibilityRelativeToClaim,
    })),
  };
}
