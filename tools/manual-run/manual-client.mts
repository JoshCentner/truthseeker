import { createHash } from 'node:crypto';
import type { LlmClient } from '../../src-pipeline/llm-client.js';

/**
 * A human-in-the-loop LlmClient. Instead of calling a model API, it answers
 * each step's prompt from a transcript file that a person (or an assistant
 * working in a chat session) fills in. Every other part of the pipeline —
 * orchestration, containment, registry, retrieval, remediation, ledger
 * assembly, and 001's engine — runs as ordinary production code.
 *
 * Why this exists: Google Search grounding has no free-tier quota for
 * accounts created after the Gemini 2.5 cutoff, which blocks
 * specs/003-judgment-pipeline-mvp/quickstart.md Part 2 entirely. This gives
 * a keyless path to producing real, inspectable runs.
 *
 * KNOWN DEVIATION FROM THE CONSTITUTION (Principle II, blind judgment): a
 * real run isolates each step in its own API call, so gradeOrigin() is
 * structurally incapable of seeing the claim or the ledger. A human or
 * assistant filling in this transcript holds all of that in one head at
 * once. Blindness here is a discipline, not an architectural guarantee.
 * Records produced this way MUST be stamped as such and MUST NOT be
 * presented as protocol-clean runs.
 */
export interface TranscriptEntry {
  /** Every substring here must appear in the prompt for this entry to match. */
  when: string[];
  kind: 'generate' | 'generateWithSearch';
  /** Free-text label for the trace — which step this was answering. */
  note?: string;
  /** The model's would-be response text. Must be the JSON the step's validator expects. */
  text: string;
  /** generateWithSearch only: the URLs "grounding" turned up. */
  groundingUrls?: string[];
}

export interface PendingPrompt {
  index: number;
  kind: 'generate' | 'generateWithSearch';
  hash: string;
  prompt: string;
}

/** Thrown when the transcript has no answer for a prompt. The runner catches
 * this, writes the unanswered prompts out for a human to read, and exits. */
export class NeedsHumanResponse extends Error {}

export class ManualLlmClient implements LlmClient {
  readonly modelId: string;
  readonly pending: PendingPrompt[] = [];
  readonly matched: { kind: string; note: string; hash: string }[] = [];
  private readonly entries: TranscriptEntry[];

  constructor(entries: TranscriptEntry[], modelId = 'claude-opus-5-manual-chat') {
    this.entries = entries;
    this.modelId = modelId;
  }

  private answer(kind: TranscriptEntry['kind'], prompt: string): TranscriptEntry {
    const hash = createHash('sha256').update(prompt).digest('hex').slice(0, 16);
    const entry = this.entries.find((e) => e.kind === kind && e.when.every((w) => prompt.includes(w)));
    if (!entry) {
      // Recorded synchronously, before throwing, so that concurrent steps
      // (run-pipeline.ts grades and marks every origin under Promise.all)
      // all register their prompts in a single pass instead of surfacing
      // one per re-run.
      if (!this.pending.some((p) => p.hash === hash)) {
        this.pending.push({ index: this.pending.length + 1, kind, hash, prompt });
      }
      throw new NeedsHumanResponse(`no transcript entry for ${kind} prompt ${hash}`);
    }
    this.matched.push({ kind, note: entry.note ?? '(unlabelled)', hash });
    return entry;
  }

  async generate(prompt: string): Promise<{ text: string }> {
    return { text: this.answer('generate', prompt).text };
  }

  async generateWithSearch(prompt: string): Promise<{ text: string; groundingUrls: string[] }> {
    const entry = this.answer('generateWithSearch', prompt);
    return { text: entry.text, groundingUrls: entry.groundingUrls ?? [] };
  }
}
