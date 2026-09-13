import type { LlmClient } from './llm-client.js';
import type { AdversarialOutput, GradingOutput, RetrievedOrigin } from './types.js';
import type { AdversarialStatus } from '../src/index.js';
import { wrapUntrustedContent } from './contain.js';
import { remediate, type RemediationResult } from './remediate.js';

/**
 * FR-031, FR-032. MVP scope decision, tracked in PROJECT-TRACKER.md: this
 * step can DETECT a genuine new weakness in the lead evidence that grading
 * missed, and reports that via revisionOccurred — but it does not yet feed
 * that weakness back into a re-graded Warrant (that would mean re-running
 * gradeOrigin with new information, a bigger loop this MVP doesn't build).
 * Reporting revisionOccurred: true without auto-revising is the honest
 * choice: it tells a human reviewer something surfaced, rather than either
 * silently ignoring it (dishonest) or fabricating a revised grade this step
 * didn't actually compute (equally dishonest, in the other direction).
 */
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

/** FR-040 (amendment): validates the shape — previously an untyped cast. */
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

function pickLeadOrigin(origins: RetrievedOrigin[], grades: GradingOutput[]): { origin: RetrievedOrigin; grade: GradingOutput } | null {
  const gradeOrder = ['assertion', 'testimony', 'contemporaneous_record', 'physical_documentary'];
  let best: { origin: RetrievedOrigin; grade: GradingOutput } | null = null;
  origins.forEach((origin, i) => {
    const grade = grades[i];
    if (!grade || grade.startingGrade === 'assertion') return; // zero-weight rule — not a candidate
    if (!best || gradeOrder.indexOf(grade.startingGrade) > gradeOrder.indexOf(best.grade.startingGrade)) {
      best = { origin, grade };
    }
  });
  return best;
}

export async function runAdversarialTest(
  claim: string,
  origins: RetrievedOrigin[],
  grades: GradingOutput[],
  llm: LlmClient,
): Promise<RemediationResult<AdversarialOutput>> {
  const lead = pickLeadOrigin(origins, grades);

  // FR-031: nothing to adversarially test if nothing survived grading —
  // 'untested' is the honest report, never a fabricated 'survived'.
  if (!lead || lead.origin.content === null) {
    return { ok: true, attempts: [], value: { status: 'untested', revisionOccurred: false } };
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
  // 001's engine correctly reflects.
  const status: AdversarialStatus = result.value.foundGenuineWeakness ? 'untested' : 'survived';
  return { ok: true, attempts: result.attempts, value: { status, revisionOccurred: result.value.foundGenuineWeakness } };
}
