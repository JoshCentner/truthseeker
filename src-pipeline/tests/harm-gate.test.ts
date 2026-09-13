import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockLlmClient } from '../llm-client.js';
import { runHarmGate } from '../harm-gate.js';
import { REVIEW_QUEUE_FILE } from '../storage.js';
import { unwrapOk } from './test-helpers.js';

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
    const result = unwrapOk(await runHarmGate('Jane Doe from 4th Street cheated on her taxes', llm, 'run-1'));
    expect(result.outcome).toBe('reject');
    if (result.outcome === 'reject') {
      expect(result.rule.length).toBeGreaterThan(0);
      expect(result.rule).not.toBe('not allowed');
    }
  });

  it("accepts a claim about a public figure's public conduct", async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ outcome: 'accept' }) } }]);
    const result = unwrapOk(await runHarmGate('The mayor voted against the proposed budget last year', llm, 'run-2'));
    expect(result.outcome).toBe('accept');
  });

  it('rejects a non-falsifiable claim with a rule distinct from the private-individual rule', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'reject', rule: 'not falsifiable-shaped — no observation could show it false' }) } },
    ]);
    const result = unwrapOk(await runHarmGate('Everything happens for a reason', llm, 'run-3'));
    expect(result.outcome).toBe('reject');
    if (result.outcome === 'reject') {
      expect(result.rule).toMatch(/falsifiab/i);
    }
  });

  it('routes a genuinely borderline claim to needs_review and writes the queue file', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'needs_review', reason: 'unclear whether this person is a public figure' }) } },
    ]);
    const result = unwrapOk(await runHarmGate('Some semi-public local blogger did X', llm, 'run-4'));
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

  it('makes exactly one LLM call when the first response is already valid', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ outcome: 'accept' }) } }]);
    await runHarmGate('An institution changed its policy', llm, 'run-5');
    expect(llm.receivedPrompts.length).toBe(1);
  });

  it('remediates unparseable classifier output — retries with the violation quoted back, succeeds on a valid retry', async () => {
    const llm = new MockLlmClient([
      { generate: { text: 'not json at all' } },
      { generate: { text: JSON.stringify({ outcome: 'accept' }) } },
    ]);
    const result = unwrapOk(await runHarmGate('Some claim', llm, 'run-6'));
    expect(result.outcome).toBe('accept');
    expect(llm.receivedPrompts[1]).toContain('not valid JSON');
  });

  it('returns ok:false (never a crash or a silent needs_review) when every attempt is unparseable', async () => {
    const llm = new MockLlmClient([
      { generate: { text: 'not json' } },
      { generate: { text: 'still not json' } },
      { generate: { text: 'still not json' } },
    ]);
    const result = await runHarmGate('Some claim', llm, 'run-7');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.attempts.length).toBe(3);
    }
  });
});
