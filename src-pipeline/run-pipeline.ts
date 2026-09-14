import { randomUUID } from 'node:crypto';
import type { LlmClient } from './llm-client.js';
import type { PipelineResult, RunOptions, RunTrace, RemediationAttempt } from './types.js';
import type { RemediationResult } from './remediate.js';
import { runHarmGate } from './harm-gate.js';
import { classifyClaim } from './classify.js';
import { discoverCandidates } from './search.js';
import { retrieveAll } from './retrieve.js';
import { gradeOrigin } from './grade.js';
import { generateRivals } from './rivals.js';
import { markDiagnosticity } from './diagnosticity.js';
import { runAdversarialTest } from './adversarial.js';
import { assembleLedger } from './assemble-ledger.js';

/** FR-044: turns a step's failed remediation attempts into plain-language
 * questions — the distinct violations across every attempt, most specific
 * (last) first, never a generic "something went wrong." */
function attemptsToQuestions(attempts: RemediationAttempt[]): string[] {
  const violations = attempts.map((a) => a.violation).filter((v): v is string => v !== null);
  return [...new Set(violations)].reverse();
}

/**
 * The single place that ever holds the claim, the ledger-in-progress, and the
 * LlmClient all at once (data-model.md's State flow). Every generative step
 * routes through remediate() internally (research.md §8, FR-040-045) — this
 * orchestrator's job is to unwrap each RemediationResult, collect every
 * attempt for the trace, and short-circuit to `needs_clarification` the
 * moment any single step exhausts its budget.
 */
export async function runOrchestration(
  claim: string,
  llm: LlmClient,
  options: RunOptions = {},
): Promise<PipelineResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const steps: RunTrace['steps'] = [];
  const remediationAttempts: RemediationAttempt[] = [];
  const stamp = (step: string) => {
    steps.push({ step, modelId: llm.modelId, timestamp: new Date().toISOString() });
    options.onProgress?.(step); // 004 (claim-dashboard) amendment — additive, optional
  };

  /** Unwraps a RemediationResult<T>: on failure, throws a sentinel this
   * function catches at the top level to build `needs_clarification` —
   * keeps every call site below a plain, linear `const x = unwrap(...)`
   * instead of repeating the same if/return at every step. */
  function unwrap<T>(step: string, result: RemediationResult<T>): T {
    remediationAttempts.push(...result.attempts);
    if (!result.ok) {
      throw new ClarificationNeeded(step, attemptsToQuestions(result.attempts));
    }
    return result.value;
  }

  try {
    // FR-001/FR-006: hard stop — nothing below executes for reject/needs_review.
    const harmGateResult = unwrap('harm-gate', await runHarmGate(claim, llm, runId));
    stamp('harm-gate');

    if (harmGateResult.outcome === 'reject') {
      return { kind: 'rejected', rule: harmGateResult.rule };
    }
    if (harmGateResult.outcome === 'needs_review') {
      return { kind: 'needs_review', reason: harmGateResult.reason, queuedAt: new Date().toISOString() };
    }

    const classification = unwrap('classify', await classifyClaim(claim, llm));
    stamp('classify');

    // search.ts's discoverCandidates does not go through remediate(): it uses
    // generateWithSearch's grounding metadata, not a structured JSON response
    // to validate, so remediate()'s "parse + validate the LLM's JSON" shape
    // doesn't apply — its own MAX_EMPTY_ATTEMPTS loop is a different, already-
    // bounded retry mechanism for a different problem (finding more sources).
    const candidates = await discoverCandidates(claim, llm);
    stamp('search');

    const origins = await retrieveAll(candidates);
    stamp('retrieve');

    const grades = await Promise.all(
      origins.map(async (o, i) => unwrap(`grade:${o.id ?? i}`, await gradeOrigin(o, llm))),
    );
    stamp('grade');

    // US6 (FR-028-030): a genuine alternative explanation, marked against every
    // surviving origin. Kept strictly downstream of grading — a rival is never
    // visible to gradeOrigin, only to markDiagnosticity (research.md §6).
    const rivals = unwrap('rivals', await generateRivals(claim, llm));
    stamp('rivals');

    const diagnostics = await Promise.all(
      origins.map(async (o, i) => unwrap(`diagnosticity:${o.id ?? i}`, await markDiagnosticity(o, claim, rivals, llm))),
    );
    stamp('diagnosticity');

    // US7 (FR-031/FR-032): actively tests the lead evidence rather than
    // defaulting to a fabricated pass.
    const adversarial = unwrap('adversarial', await runAdversarialTest(claim, origins, grades, llm));
    stamp('adversarial');

    const extraordinaryClusterSurvivedAdversarialTesting = classification.isExtraordinary ? false : null;

    const ledger = assembleLedger({
      claim,
      classification,
      origins,
      grades,
      diagnostics,
      rivals,
      adversarialStatus: adversarial.status,
      steelmanRevisionOccurred: adversarial.revisionOccurred,
      extraordinaryClusterSurvivedAdversarialTesting,
    });
    stamp('assemble-ledger');

    const trace: RunTrace = {
      runId,
      requester: options.requester ?? null,
      modelIds: [llm.modelId],
      startedAt,
      completedAt: new Date().toISOString(),
      steps,
      remediationAttempts,
    };

    return { kind: 'completed', ledger, trace };
  } catch (err) {
    if (err instanceof ClarificationNeeded) {
      return { kind: 'needs_clarification', step: err.step, questions: err.questions };
    }
    throw err;
  }
}

/** Internal control-flow sentinel only — never escapes runOrchestration
 * (caught immediately above). Not a real error condition; used purely to
 * unwind out of the sequential step chain the moment remediation is
 * exhausted, without threading an early-return check through every line. */
class ClarificationNeeded extends Error {
  constructor(
    public readonly step: string,
    public readonly questions: string[],
  ) {
    super(`needs_clarification: ${step}`);
  }
}
