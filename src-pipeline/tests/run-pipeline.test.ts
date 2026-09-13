import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockLlmClient } from '../llm-client.js';
import { runOrchestration } from '../run-pipeline.js';
import { evaluate } from '../../src/index.js';

let scratchDir: string;

beforeEach(() => {
  scratchDir = mkdtempSync(path.join(tmpdir(), 'pipeline-test-'));
  process.env.PIPELINE_RUNS_DIR = scratchDir;
});

afterEach(() => {
  delete process.env.PIPELINE_RUNS_DIR;
  rmSync(scratchDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('run-pipeline end to end (accept path, User Stories 1-5)', () => {
  it("produces a PipelineResult whose ledger 001's real evaluate() accepts", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('This is real, verifiable article content about the claim.', { status: 200 })),
    );

    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'accept' }) } },
      { generate: { text: JSON.stringify({ primary: 'simple_factual', confidence: 'high', isExtraordinary: false }) } },
      { generateWithSearch: { text: '', groundingUrls: ['https://real.example.com/article'] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      {
        generate: {
          text: JSON.stringify({
            startingGrade: 'contemporaneous_record',
            firedTriggers: [],
            interestedParty: false,
            partyControlledCreationAfterStakesVisible: false,
            sourceReliabilityGrade: 'Unknown',
            reasoning: 'test',
          }),
        },
      },
      {
        generate: {
          text: JSON.stringify({
            rivals: [{ description: 'An alternative explanation for the claim', plausibilityRelativeToClaim: 'less_or_equally_plausible' }],
          }),
        },
      },
      { generate: { text: JSON.stringify({ claim: 'consistent', rivals: { 'rival-0': 'not_applicable' } }) } },
      { generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } },
    ]);

    const result = await runOrchestration('A well-documented public claim', llm);

    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;

    expect(result.ledger.origins.length).toBe(1);
    expect(result.ledger.rivals.length).toBe(1);
    expect(result.ledger.adversarialStatus).toBe('survived');
    expect(result.trace.steps.map((s) => s.step)).toEqual([
      'harm-gate',
      'classify',
      'search',
      'retrieve',
      'grade',
      'rivals',
      'diagnosticity',
      'adversarial',
      'assemble-ledger',
    ]);

    const verdict = evaluate(result.ledger);
    expect(verdict.refusalReason, `unexpected refusal: ${verdict.refusalReason}`).toBeNull();
    expect(['probable', 'contested']).toContain(verdict.band);
  });

  it('stops at the harm gate for a rejected claim — no search/grade/diagnosticity calls at all', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ outcome: 'reject', rule: 'names a private individual' }) } }]);
    const result = await runOrchestration('Jane Doe cheated on her taxes', llm);
    expect(result.kind).toBe('rejected');
    expect(llm.receivedPrompts.length).toBe(1);
  });
});

describe('run-pipeline end to end — bounded remediation (User Story 8)', () => {
  it('a step invalid on attempt 1 and valid on attempt 2 still reaches completed, with both attempts traced', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('This is real, verifiable article content about the claim.', { status: 200 })),
    );

    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'accept' }) } },
      { generate: { text: 'not valid json at all' } }, // classify attempt 1: invalid
      { generate: { text: JSON.stringify({ primary: 'simple_factual', confidence: 'high', isExtraordinary: false }) } }, // classify attempt 2: valid
      { generateWithSearch: { text: '', groundingUrls: ['https://real.example.com/article'] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      {
        generate: {
          text: JSON.stringify({
            startingGrade: 'contemporaneous_record',
            firedTriggers: [],
            interestedParty: false,
            partyControlledCreationAfterStakesVisible: false,
            sourceReliabilityGrade: 'Unknown',
            reasoning: 'test',
          }),
        },
      },
      {
        generate: {
          text: JSON.stringify({
            rivals: [{ description: 'An alternative explanation for the claim', plausibilityRelativeToClaim: 'less_or_equally_plausible' }],
          }),
        },
      },
      { generate: { text: JSON.stringify({ claim: 'consistent', rivals: { 'rival-0': 'not_applicable' } }) } },
      { generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } },
    ]);

    const result = await runOrchestration('A well-documented public claim', llm);

    expect(result.kind).toBe('completed');
    if (result.kind !== 'completed') return;
    const classifyAttempts = result.trace.remediationAttempts.filter((a) => a.step === 'classify');
    expect(classifyAttempts.length).toBe(2);
    expect(classifyAttempts[0]!.succeeded).toBe(false);
    expect(classifyAttempts[1]!.succeeded).toBe(true);
  });

  it('a step invalid on every attempt produces needs_clarification, never a crash', async () => {
    const llm = new MockLlmClient([
      { generate: { text: 'not json' } },
      { generate: { text: 'still not json' } },
      { generate: { text: 'still not json' } },
    ]);
    const result = await runOrchestration('Some claim', llm);
    expect(result.kind).toBe('needs_clarification');
    if (result.kind !== 'needs_clarification') return;
    expect(result.step).toBe('harm-gate');
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
