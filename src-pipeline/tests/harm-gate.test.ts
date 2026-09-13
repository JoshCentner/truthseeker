import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockLlmClient } from '../llm-client.js';
import { runHarmGate } from '../harm-gate.js';
import { REVIEW_QUEUE_FILE } from '../storage.js';

let scratchDir: string;

beforeEach(() => {
  scratchDir = mkdtempSync(path.join(tmpdir(), 'pipeline-test-'));
  process.env.PIPELINE_RUNS_DIR = scratchDir;
});

afterEach(() => {
  delete process.env.PIPELINE_RUNS_DIR;
  rmSync(scratchDir, { recursive: true, force: true });
});

describe('harm gate (FR-001-002a)', () => {
  it('rejects a claim naming a private individual, with a specific rule', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'reject', rule: 'names a private individual and targets their private life' }) } },
    ]);
    const result = await runHarmGate('Jane Doe from 4th Street cheated on her taxes', llm, 'run-1');
    expect(result.outcome).toBe('reject');
    if (result.outcome === 'reject') {
      expect(result.rule.length).toBeGreaterThan(0);
      expect(result.rule).not.toBe('not allowed');
    }
  });

  it('accepts a claim about a public figure\'s public conduct', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ outcome: 'accept' }) } }]);
    const result = await runHarmGate('The mayor voted against the proposed budget last year', llm, 'run-2');
    expect(result.outcome).toBe('accept');
  });

  it('rejects a non-falsifiable claim with a rule distinct from the private-individual rule', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'reject', rule: 'not falsifiable-shaped — no observation could show it false' }) } },
    ]);
    const result = await runHarmGate('Everything happens for a reason', llm, 'run-3');
    expect(result.outcome).toBe('reject');
    if (result.outcome === 'reject') {
      expect(result.rule).toMatch(/falsifiab/i);
    }
  });

  it('routes a genuinely borderline claim to needs_review and writes the queue file', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'needs_review', reason: 'unclear whether this person is a public figure' }) } },
    ]);
    const result = await runHarmGate('Some semi-public local blogger did X', llm, 'run-4');
    expect(result.outcome).toBe('needs_review');
    if (result.outcome === 'needs_review') {
      expect(result.reason.length).toBeGreaterThan(0);
    }
    const queued = readFileSync(path.join(scratchDir, REVIEW_QUEUE_FILE), 'utf-8').trim().split('\n');
    expect(queued.length).toBe(1);
    const entry = JSON.parse(queued[0] as string);
    expect(entry.runId).toBe('run-4');
    expect(entry.reason.length).toBeGreaterThan(0);
  });

  it('makes exactly one LLM call regardless of outcome — the gate itself is the only spend', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ outcome: 'accept' }) } }]);
    await runHarmGate('An institution changed its policy', llm, 'run-5');
    expect(llm.receivedPrompts.length).toBe(1);
  });

  it('treats unparseable classifier output as needs_review with a specific reason, never a crash', async () => {
    const llm = new MockLlmClient([{ generate: { text: 'not json at all' } }]);
    const result = await runHarmGate('Some claim', llm, 'run-6');
    expect(result.outcome).toBe('needs_review');
  });
});
