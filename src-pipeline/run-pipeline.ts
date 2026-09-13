import { randomUUID } from 'node:crypto';
import type { LlmClient } from './llm-client.js';
import type { PipelineResult, RunOptions, RunTrace } from './types.js';
import { runHarmGate } from './harm-gate.js';
import { classifyClaim } from './classify.js';
import { discoverCandidates } from './search.js';
import { retrieveAll } from './retrieve.js';
import { gradeOrigin } from './grade.js';
import { generateRivals } from './rivals.js';
import { markDiagnosticity } from './diagnosticity.js';
import { runAdversarialTest } from './adversarial.js';
import { assembleLedger } from './assemble-ledger.js';

/**
 * The single place that ever holds the claim, the ledger-in-progress, and the
 * LlmClient all at once (data-model.md's State flow). Rivals (US6) and
 * adversarial testing (US7) are wired in as additive extensions once their
 * own phases land — for MVP (US1-US5) they default to empty/untested, which
 * 001's engine already handles as an honest, correctly-capped outcome
 * rather than a gap that silently overclaims.
 */
export async function runOrchestration(
  claim: string,
  llm: LlmClient,
  options: RunOptions = {},
): Promise<PipelineResult> {
  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const steps: RunTrace['steps'] = [];
  const stamp = (step: string) => steps.push({ step, modelId: llm.modelId, timestamp: new Date().toISOString() });

  // FR-001/FR-006: hard stop — nothing below executes for reject/needs_review.
  const harmGateResult = await runHarmGate(claim, llm, runId);
  stamp('harm-gate');

  if (harmGateResult.outcome === 'reject') {
    return { kind: 'rejected', rule: harmGateResult.rule };
  }
  if (harmGateResult.outcome === 'needs_review') {
    return { kind: 'needs_review', reason: harmGateResult.reason, queuedAt: new Date().toISOString() };
  }

  const classification = await classifyClaim(claim, llm);
  stamp('classify');

  const candidates = await discoverCandidates(claim, llm);
  stamp('search');

  const origins = await retrieveAll(candidates);
  stamp('retrieve');

  const grades = await Promise.all(origins.map((o) => gradeOrigin(o, llm)));
  stamp('grade');

  // US6 (FR-028-030): a genuine alternative explanation, marked against every
  // surviving origin. Kept strictly downstream of grading — a rival is never
  // visible to gradeOrigin, only to markDiagnosticity (research.md §6).
  const rivals = await generateRivals(claim, llm);
  stamp('rivals');

  const diagnostics = await Promise.all(origins.map((o) => markDiagnosticity(o, claim, rivals, llm)));
  stamp('diagnosticity');

  // US7 (FR-031/FR-032): actively tests the lead evidence rather than
  // defaulting to a fabricated pass.
  const adversarial = await runAdversarialTest(claim, origins, grades, llm);
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
  };

  return { kind: 'completed', ledger, trace };
}
