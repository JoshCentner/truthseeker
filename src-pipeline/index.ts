import { randomUUID } from 'node:crypto';
import { GeminiLlmClient, LlmAuthError } from './llm-client.js';
import { runOrchestration } from './run-pipeline.js';
import type { PipelineResult, RunOptions } from './types.js';

export type { PipelineResult, RunOptions } from './types.js';
export { MockLlmClient, LlmAuthError, GeminiLlmClient } from './llm-client.js';
export type { LlmClient } from './llm-client.js';
/**
 * 004 (claim-dashboard) amendment: exposed so a caller that needs to drive
 * the orchestration with its own LlmClient — a real one it constructs
 * itself, or MockLlmClient for tests — can do so directly, without
 * duplicating run-pipeline.ts's step sequence. runPipeline() below remains
 * the recommended entry point for anything that just needs "claim + key in,
 * result out"; this export is for a caller (like the dashboard's server)
 * that specifically needs client injection runPipeline()'s own
 * apiKey-in/GeminiLlmClient-out shape doesn't allow.
 */
export { runOrchestration } from './run-pipeline.js';

/**
 * FR-007: requires a caller-supplied key; never falls back to an
 * operator-owned one (there is no such fallback anywhere in this module).
 * Throws only for this programmer-error case — every other outcome (harm-gate
 * rejection, needs-review, auth failure, a completed ledger) is a normal
 * return value, per contracts/pipeline-api.md.
 */
export async function runPipeline(
  claim: string,
  apiKey: string,
  options: RunOptions = {},
): Promise<PipelineResult> {
  if (!apiKey) {
    throw new Error('runPipeline requires a non-empty apiKey (FR-007) — this feature never falls back to an operator-owned key');
  }

  const llm = new GeminiLlmClient(apiKey, options.modelId);

  try {
    return await runOrchestration(claim, llm, options);
  } catch (err) {
    // FR-010: an authorization failure is distinguished from every other
    // failure category this pipeline can produce.
    if (err instanceof LlmAuthError) {
      return { kind: 'auth_failed', message: err.message };
    }
    throw err;
  }
}

/** Exposed so index.test.ts and the CLI can generate a run id consistently without duplicating the logic. */
export function newRunId(): string {
  return randomUUID();
}
