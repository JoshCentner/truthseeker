import type { LlmClient } from './llm-client.js';
import type { RivalHypothesis } from './types.js';
import type { Rival } from '../src/index.js';

/**
 * FR-028, FR-029: model reasoning MAY generate a hypothesis to test — it MUST
 * NOT serve as evidence in its own right (Constitution Principle II). The
 * "hypothesis, not evidence" framing is structural, not just a comment: this
 * function's return type is RivalHypothesis, never anything that could be
 * mistaken for a GradingOutput or fed into gradeOrigin/assembleLedger's
 * origin-grading paths — a rival only ever becomes an input to
 * markDiagnosticity, never to grading.
 */
const RIVALS_PROMPT = (claim: string): string => `Propose at least one genuinely plausible alternative explanation for this claim — a real
competing account a thoughtful skeptic might raise, not a strawman.

Claim: ${JSON.stringify(claim)}

For each rival, also judge whether it seems more plausible than the claim itself, or less/equally
plausible, based on general reasoning alone (this is a hypothesis to test against the evidence,
not a conclusion — the evidence itself is graded separately and blind to this).

Respond with exactly one JSON object, no other text:
{ "rivals": [ { "description": "<the alternative explanation>", "plausibilityRelativeToClaim": "more_plausible" | "less_or_equally_plausible" } ] }`;

interface RawRivalsResponse {
  rivals: { description: string; plausibilityRelativeToClaim: Rival['plausibilityRelativeToClaim'] }[];
}

export async function generateRivals(claim: string, llm: LlmClient): Promise<RivalHypothesis[]> {
  const response = await llm.generate(RIVALS_PROMPT(claim));
  const cleaned = response.text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
  const raw: RawRivalsResponse = JSON.parse(cleaned);

  return raw.rivals.map((r, i) => ({
    id: `rival-${i}`,
    description: r.description,
    plausibilityRelativeToClaim: r.plausibilityRelativeToClaim,
  }));
}
