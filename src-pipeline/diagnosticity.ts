import type { LlmClient } from './llm-client.js';
import type { RetrievedOrigin, RivalHypothesis, DiagnosticityOutput } from './types.js';
import type { DiagnosticMark } from '../src/index.js';
import { wrapUntrustedContent } from './contain.js';

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
): Promise<DiagnosticityOutput> {
  if (origin.content === null) {
    return { markAgainstClaim: 'not_applicable', marksAgainstRivals: {} };
  }

  const rivalsBlock =
    rivals.length > 0
      ? `\n\nAlso mark this origin against each of these rival explanations:\n${rivals
          .map((r) => `- ${r.id}: ${r.description}`)
          .join('\n')}`
      : '';

  // FR-017: fetched content stays inside the delimited, explicitly-untrusted
  // block even here, where the claim itself is legitimately visible (FR-027)
  // — visibility to the claim is not the same as trusting the content as
  // instructions.
  const prompt = `Claim: ${JSON.stringify(claim)}

${wrapUntrustedContent(origin.id, origin.content)}${rivalsBlock}

For the claim, and for each rival listed (if any), mark this origin's relationship as exactly one
of: "consistent", "inconsistent", or "not_applicable". Never leave anything unmarked.

Respond with exactly one JSON object, no other text:
{ "claim": "consistent" | "inconsistent" | "not_applicable", "rivals": { "<rivalId>": "consistent" | "inconsistent" | "not_applicable", ... } }`;

  const response = await llm.generate(prompt);
  const cleaned = response.text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
  const raw: { claim: DiagnosticMark; rivals?: Record<string, DiagnosticMark> } = JSON.parse(cleaned);

  // FR-026: every surviving origin receives exactly one mark against the claim, never unmarked.
  const markAgainstClaim: DiagnosticMark = raw.claim ?? 'not_applicable';
  const marksAgainstRivals: Record<string, DiagnosticMark> = {};
  for (const rival of rivals) {
    marksAgainstRivals[rival.id] = raw.rivals?.[rival.id] ?? 'not_applicable';
  }

  return { markAgainstClaim, marksAgainstRivals };
}
