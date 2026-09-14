import { runOrchestration, LlmAuthError, GeminiLlmClient, type PipelineResult, type LlmClient } from '../src-pipeline/index.js';

/** Thrown from inside onProgress once aborted() returns true — a purely
 * internal control-flow signal, never surfaced to the HTTP caller. */
class RunAborted extends Error {}

export interface RunWithProgressOptions {
  requester?: string;
  /** Injectable for tests (research.md's MockLlmClient-based testing strategy)
   * — defaults to a real GeminiLlmClient built from the supplied key. */
  llm?: LlmClient;
}

/**
 * research.md §4: the caller (server.ts) passes `aborted()` returning true
 * once the client has disconnected. This function checks it cooperatively
 * inside onProgress — the only point 003's sequential orchestration yields
 * control back here between steps — rather than requiring any change to
 * 003's own control flow beyond the already-additive onProgress callback.
 *
 * Uses 003's runOrchestration() directly (not runPipeline()) specifically so
 * a MockLlmClient can be injected for tests — see 003's contracts/
 * pipeline-api.md for why this is a deliberate, documented choice, not a
 * workaround. This function therefore takes on runPipeline()'s own two small
 * responsibilities itself: requiring a non-empty apiKey when no llm is
 * injected, and mapping LlmAuthError to a PipelineResult.
 */
export async function runWithProgress(
  claim: string,
  apiKey: string,
  onProgress: (step: string) => void,
  aborted: () => boolean,
  options: RunWithProgressOptions = {},
): Promise<PipelineResult | { aborted: true }> {
  const llm = options.llm ?? new GeminiLlmClient(apiKey);

  try {
    const result = await runOrchestration(claim, llm, {
      requester: options.requester,
      onProgress: (step) => {
        onProgress(step);
        if (aborted()) {
          throw new RunAborted();
        }
      },
    });
    return result;
  } catch (err) {
    if (err instanceof RunAborted) {
      return { aborted: true };
    }
    if (err instanceof LlmAuthError) {
      return { kind: 'auth_failed', message: err.message };
    }
    throw err;
  }
}
