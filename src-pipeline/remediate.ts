import type { LlmClient } from './llm-client.js';
import type { RemediationAttempt } from './types.js';

/**
 * FR-042, research.md §9: a conservative starting constant, not yet informed
 * by observed failure-mode data (this MVP has produced zero real runs) — to
 * be revisited once it has, per the constitution's "set from observed
 * failure modes, not guessed."
 */
export const MAX_REMEDIATION_ATTEMPTS = 2;

export type RemediationResult<T> =
  | { ok: true; value: T; attempts: RemediationAttempt[] }
  | { ok: false; attempts: RemediationAttempt[] };

/**
 * FR-040, FR-041, FR-043: wraps any "build a prompt, call the LLM, validate
 * the response" step. `buildPrompt(undefined)` is the original attempt;
 * `buildPrompt(violation)` is called for each retry with the SPECIFIC
 * violation from the previous attempt substituted in — never a generic
 * "please try again." Every attempt, successful or not, is recorded.
 */
export async function remediate<T>(
  step: string,
  llm: LlmClient,
  buildPrompt: (violation?: string) => string,
  validate: (raw: unknown) => { ok: true; value: T } | { ok: false; violation: string },
  maxAttempts: number = MAX_REMEDIATION_ATTEMPTS,
): Promise<RemediationResult<T>> {
  const attempts: RemediationAttempt[] = [];
  let violation: string | undefined;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts + 1; attemptNumber++) {
    const prompt = buildPrompt(violation);
    const response = await llm.generate(prompt);

    let parsed: unknown;
    let parseViolation: string | null = null;
    try {
      const cleaned = response.text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
      parsed = JSON.parse(cleaned);
    } catch (err) {
      parseViolation = `response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`;
    }

    if (parseViolation) {
      attempts.push({ step, attemptNumber, violation: parseViolation, succeeded: false });
      violation = parseViolation;
      continue;
    }

    const result = validate(parsed);
    if (result.ok) {
      attempts.push({ step, attemptNumber, violation: null, succeeded: true });
      return { ok: true, value: result.value, attempts };
    }

    attempts.push({ step, attemptNumber, violation: result.violation, succeeded: false });
    violation = result.violation;
  }

  return { ok: false, attempts };
}
