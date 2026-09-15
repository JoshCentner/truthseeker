import { GoogleGenAI } from '@google/genai';

// ---------------------------------------------------------------------------
// T005: the interface every other module in this feature depends on. Nothing
// outside this file imports @google/genai directly — that's what makes the
// whole orchestration testable without a real key or network access.
// ---------------------------------------------------------------------------

export interface LlmClient {
  readonly modelId: string;
  generate(prompt: string): Promise<{ text: string }>;
  generateWithSearch(prompt: string): Promise<{ text: string; groundingUrls: string[] }>;
}

/** Thrown by GeminiLlmClient specifically for an authorization failure (FR-010) — the
 * orchestrator catches this type to distinguish it from every other failure. */
export class LlmAuthError extends Error {}

// ---------------------------------------------------------------------------
// T006: scriptable fake — exported (not test-only) so every later test file
// can reuse it, per plan.md's testing strategy.
// ---------------------------------------------------------------------------

export interface MockResponse {
  generate?: { text: string };
  generateWithSearch?: { text: string; groundingUrls: string[] };
  throwAuthError?: boolean;
}

export class MockLlmClient implements LlmClient {
  readonly modelId = 'mock-model';
  private queue: MockResponse[];
  /** Every prompt this mock actually received, in order — tests use this to
   * assert what a call was (or wasn't) given, e.g. that grading never saw a
   * claim string (SC-006). */
  readonly receivedPrompts: string[] = [];

  constructor(responses: MockResponse[] = []) {
    this.queue = [...responses];
  }

  private next(): MockResponse {
    const r = this.queue.shift();
    if (!r) {
      throw new Error('MockLlmClient: no more scripted responses queued');
    }
    return r;
  }

  async generate(prompt: string): Promise<{ text: string }> {
    this.receivedPrompts.push(prompt);
    const r = this.next();
    if (r.throwAuthError) throw new LlmAuthError('mock auth failure');
    return r.generate ?? { text: '' };
  }

  async generateWithSearch(prompt: string): Promise<{ text: string; groundingUrls: string[] }> {
    this.receivedPrompts.push(prompt);
    const r = this.next();
    if (r.throwAuthError) throw new LlmAuthError('mock auth failure');
    return r.generateWithSearch ?? { text: '', groundingUrls: [] };
  }
}

// ---------------------------------------------------------------------------
// T007: the real implementation. Never logs the key; the key lives only in
// the GoogleGenAI client instance for the lifetime of one GeminiLlmClient.
// ---------------------------------------------------------------------------

const DEFAULT_MODEL_ID = 'gemini-3.6-flash'; // research.md §1 — single tier for this MVP. 2026-09-14: gemini-2.5-flash now 404s for new users; Google's error names 3.6-flash as the replacement.

export class GeminiLlmClient implements LlmClient {
  readonly modelId: string;
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, modelId: string = DEFAULT_MODEL_ID) {
    if (!apiKey) {
      throw new Error('GeminiLlmClient requires a non-empty apiKey');
    }
    this.modelId = modelId;
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(prompt: string): Promise<{ text: string }> {
    try {
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: prompt,
      });
      return { text: response.text ?? '' };
    } catch (err) {
      throw translateError(err);
    }
  }

  async generateWithSearch(prompt: string): Promise<{ text: string; groundingUrls: string[] }> {
    try {
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
      });
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const groundingUrls = chunks
        .map((c) => c.web?.uri)
        .filter((u): u is string => typeof u === 'string');
      return { text: response.text ?? '', groundingUrls };
    } catch (err) {
      throw translateError(err);
    }
  }
}

/** FR-010: an authorization failure MUST be distinguishable from every other
 * failure category. The SDK surfaces auth problems as an error whose message
 * or status indicates 401/403/API-key issues; this narrows that down to a
 * typed LlmAuthError rather than leaving callers to string-match themselves.
 * Exported for direct unit testing (src-pipeline/tests/llm-client.test.ts)
 * without needing a real network call to exercise it. */
export function translateError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/api[_ ]?key|unauthorized|401|403|permission/i.test(message)) {
    return new LlmAuthError(message);
  }
  return err instanceof Error ? err : new Error(message);
}
