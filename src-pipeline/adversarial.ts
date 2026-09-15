import type { LlmClient } from './llm-client.js';
import type { AdversarialOutput, DiagnosticityOutput, GradingOutput, RetrievedOrigin } from './types.js';
import type { AdversarialStatus } from '../src/index.js';
import { wrapUntrustedContent } from './contain.js';
import { remediate, type RemediationResult } from './remediate.js';

const ADVERSARIAL_PROMPT = (claim: string, sourceId: string, leadContent: string, violation?: string): string => {
  const base = `You are actively trying to falsify this claim's strongest evidence — a genuine adversarial
attempt, not a formality. Look for a specific, real weakness: a confound, a missing safeguard,
an alternative reading of the evidence, anything that would matter if true.

Claim: ${JSON.stringify(claim)}

Strongest surviving evidence:
${wrapUntrustedContent(sourceId, leadContent)}

Respond with exactly one JSON object, no other text:
{ "foundGenuineWeakness": boolean, "weaknessDescription": "<specific description, or empty string if none>" }`;
  return violation
    ? `${base}\n\nYour previous response was invalid: ${violation}\nRespond again, correcting exactly that issue.`
    : base;
};

interface RawAdversarialResponse {
  foundGenuineWeakness: boolean;
  weaknessDescription: string;
}

function validateAdversarial(raw: unknown): { ok: true; value: RawAdversarialResponse } | { ok: false; violation: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, violation: 'response was not a JSON object' };
  }
  const r = raw as Partial<RawAdversarialResponse>;
  if (typeof r.foundGenuineWeakness !== 'boolean') {
    return { ok: false, violation: '"foundGenuineWeakness" must be a boolean' };
  }
  if (typeof r.weaknessDescription !== 'string') {
    return { ok: false, violation: '"weaknessDescription" must be a string (use "" if none)' };
  }
  return { ok: true, value: r as RawAdversarialResponse };
}

const GRADE_ORDER = ['assertion', 'testimony', 'contemporaneous_record', 'physical_documentary'];

/**
 * Picks the line worth attacking. Ordering is by BEARING first, then warrant
 * grade — reversed from the original, which sorted on grade alone.
 *
 * Why it changed (2026-09-15): in a live run on "The Great Wall of China is
 * visible from space with the naked eye." this function selected a NASA ASTER
 * instrument image as the "strongest surviving evidence" purely because it
 * graded physical_documentary, even though the diagnosticity step had marked it
 * `not_applicable` against the claim. The adversarial pass then attacked a line
 * with no bearing on the claim while the two lines that did bear on it went
 * untested. Highest warrant is not the same thing as most load-bearing, and it
 * is the load-bearing line that a steelman has to survive.
 */
function pickLeadOrigin(
  origins: RetrievedOrigin[],
  grades: GradingOutput[],
  diagnostics: DiagnosticityOutput[],
): { origin: RetrievedOrigin; grade: GradingOutput } | null {
  let best: { origin: RetrievedOrigin; grade: GradingOutput; bears: boolean } | null = null;
  origins.forEach((origin, i) => {
    const grade = grades[i];
    if (!grade || grade.startingGrade === 'assertion') return; // zero-weight rule — not a candidate
    // A line with no diagnosticity output yet is treated as bearing on the
    // claim rather than excluded: absent information should not silently
    // demote a line out of adversarial testing.
    const bears = diagnostics[i] === undefined || diagnostics[i]!.markAgainstClaim !== 'not_applicable';
    if (!best) {
      best = { origin, grade, bears };
      return;
    }
    if (best.bears !== bears) {
      if (bears) best = { origin, grade, bears };
      return;
    }
    if (GRADE_ORDER.indexOf(grade.startingGrade) > GRADE_ORDER.indexOf(best.grade.startingGrade)) {
      best = { origin, grade, bears };
    }
  });
  if (!best) return null;
  const { origin, grade } = best;
  return { origin, grade };
}

export async function runAdversarialTest(
  claim: string,
  origins: RetrievedOrigin[],
  grades: GradingOutput[],
  diagnostics: DiagnosticityOutput[],
  llm: LlmClient,
): Promise<RemediationResult<AdversarialOutput>> {
  const lead = pickLeadOrigin(origins, grades, diagnostics);

  // FR-031: nothing to adversarially test if nothing survived grading —
  // 'untested' is the honest report, never a fabricated 'survived'.
  if (!lead || lead.origin.content === null) {
    return { ok: true, attempts: [], value: { status: 'untested', revisionOccurred: false, performed: false } };
  }

  const content = lead.origin.content;
  const result = await remediate(
    `adversarial:${lead.origin.id}`,
    llm,
    (violation) => ADVERSARIAL_PROMPT(claim, lead.origin.id, content, violation),
    validateAdversarial,
  );
  if (!result.ok) {
    return result;
  }

  // A test that finds a genuine weakness did NOT confirm the evidence
  // survived scrutiny — reporting 'survived' anyway would be exactly the
  // overclaiming this whole project is built to prevent. 'untested' is the
  // honest report here too: not because no test ran, but because the
  // evidence's Established-worthiness under adversarial pressure isn't
  // confirmed, which is exactly what 'untested''s Probable-capping effect in
  // 001's engine correctly reflects. `performed` carries the separate fact
  // that a test did run, so the ledger's steelman record stays coherent.
  const status: AdversarialStatus = result.value.foundGenuineWeakness ? 'untested' : 'survived';
  return {
    ok: true,
    attempts: result.attempts,
    value: { status, revisionOccurred: result.value.foundGenuineWeakness, performed: true },
  };
}
