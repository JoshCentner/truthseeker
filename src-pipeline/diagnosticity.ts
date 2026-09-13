import type { LlmClient } from './llm-client.js';
import type { RetrievedOrigin, RivalHypothesis, DiagnosticityOutput } from './types.js';
import type { DiagnosticMark } from '../src/index.js';
import { wrapUntrustedContent } from './contain.js';
import { remediate, type RemediationResult } from './remediate.js';

const VALID_MARKS: DiagnosticMark[] = ['consistent', 'inconsistent', 'not_applicable'];

interface RawDiagnosticityResponse {
  claim: DiagnosticMark;
  rivals?: Record<string, DiagnosticMark>;
}

/** FR-026, FR-040 (amendment): every mark, including each rival's, must be
 * one of the three valid values — previously an invalid/missing mark
 * silently defaulted to not_applicable rather than being caught. */
function validateDiagnosticity(raw: unknown): { ok: true; value: RawDiagnosticityResponse } | { ok: false; violation: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, violation: 'response was not a JSON object' };
  }
  const r = raw as Partial<RawDiagnosticityResponse>;
  if (typeof r.claim !== 'string' || !VALID_MARKS.includes(r.claim)) {
    return { ok: false, violation: `"claim" must be one of ${VALID_MARKS.join(', ')}, got ${JSON.stringify(r.claim)}` };
  }
  if (r.rivals !== undefined) {
    for (const [rivalId, mark] of Object.entries(r.rivals)) {
      if (!VALID_MARKS.includes(mark)) {
        return { ok: false, violation: `rival "${rivalId}"'s mark must be one of ${VALID_MARKS.join(', ')}, got ${JSON.stringify(mark)}` };
      }
    }
  }
  return { ok: true, value: r as RawDiagnosticityResponse };
}

/**
 * FR-026, FR-027: unlike gradeOrigin, this DOES take the claim — this
 * judgment is inherently about the origin/claim relationship, which
 * Constitution Principle II explicitly permits (only warrant grading must be
 * blind).
 */
export async function markDiagnosticity(
  origin: RetrievedOrigin,
  claim: string,
  rivals: RivalHypothesis[],
  llm: LlmClient,
): Promise<RemediationResult<DiagnosticityOutput>> {
  if (origin.content === null) {
    return { ok: true, attempts: [], value: { markAgainstClaim: 'not_applicable', marksAgainstRivals: {} } };
  }

  const rivalsBlock =
    rivals.length > 0
      ? `\n\nAlso mark this origin against each of these rival explanations:\n${rivals
          .map((r) => `- ${r.id}: ${r.description}`)
          .join('\n')}`
      : '';

  const buildPrompt = (violation?: string): string => {
    // FR-017: fetched content stays inside the delimited, explicitly-untrusted
    // block even here, where the claim itself is legitimately visible (FR-027)
    // — visibility to the claim is not the same as trusting the content as
    // instructions.
    const base = `Claim: ${JSON.stringify(claim)}

${wrapUntrustedContent(origin.id, origin.content as string)}${rivalsBlock}

For the claim, and for each rival listed (if any), mark this origin's relationship as exactly one
of: "consistent", "inconsistent", or "not_applicable". Never leave anything unmarked.

Respond with exactly one JSON object, no other text:
{ "claim": "consistent" | "inconsistent" | "not_applicable", "rivals": { "<rivalId>": "consistent" | "inconsistent" | "not_applicable", ... } }`;
    return violation
      ? `${base}\n\nYour previous response was invalid: ${violation}\nRespond again, correcting exactly that issue.`
      : base;
  };

  const result = await remediate(`diagnosticity:${origin.id}`, llm, buildPrompt, validateDiagnosticity);
  if (!result.ok) {
    return result;
  }

  const raw = result.value;
  const marksAgainstRivals: Record<string, DiagnosticMark> = {};
  for (const rival of rivals) {
    marksAgainstRivals[rival.id] = raw.rivals?.[rival.id] ?? 'not_applicable';
  }

  return {
    ok: true,
    attempts: result.attempts,
    value: { markAgainstClaim: raw.claim, marksAgainstRivals },
  };
}
