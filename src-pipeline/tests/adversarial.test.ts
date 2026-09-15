import { describe, it, expect } from 'vitest';
import { runAdversarialTest } from '../adversarial.js';
import { MockLlmClient } from '../llm-client.js';
import type { RetrievedOrigin, GradingOutput, DiagnosticityOutput } from '../types.js';
import { unwrapOk } from './test-helpers.js';

function origin(id: string, content: string | null): RetrievedOrigin {
  return {
    id,
    candidate: { url: `https://example.com/${id}`, title: '', foundVia: 'test' },
    fetch: { requestedUrl: `https://example.com/${id}`, finalUrl: null, succeeded: content !== null, httpStatus: null, contentHash: null, fetchedAt: '' },
    content,
    registryClass: null,
  };
}

function grade(startingGrade: GradingOutput['startingGrade']): GradingOutput {
  return {
    startingGrade,
    firedTriggers: [],
    interestedParty: false,
    partyControlledCreationAfterStakesVisible: false,
    sourceReliabilityGrade: 'reliable',
    rawModelReasoning: '',
  };
}

function diag(markAgainstClaim: DiagnosticityOutput['markAgainstClaim']): DiagnosticityOutput {
  return { markAgainstClaim, marksAgainstRivals: {} };
}

describe('adversarial testing (FR-031, FR-032)', () => {
  it("'untested' is the honest default when nothing survived grading — no LLM call made", async () => {
    const llm = new MockLlmClient([]);
    const result = unwrapOk(
      await runAdversarialTest('claim', [origin('o1', 'content')], [grade('assertion')], [diag('consistent')], llm),
    );
    expect(result.status).toBe('untested');
    expect(result.revisionOccurred).toBe(false);
    expect(result.performed).toBe(false);
    expect(llm.receivedPrompts.length).toBe(0);
  });

  it("'untested' when there are no origins at all", async () => {
    const llm = new MockLlmClient([]);
    const result = unwrapOk(await runAdversarialTest('claim', [], [], [], llm));
    expect(result.status).toBe('untested');
    expect(result.performed).toBe(false);
  });

  it("'survived' requires a completed test that found no genuine weakness", async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } }]);
    const result = unwrapOk(
      await runAdversarialTest(
        'claim',
        [origin('o1', 'strong content')],
        [grade('physical_documentary')],
        [diag('consistent')],
        llm,
      ),
    );
    expect(result.status).toBe('survived');
    expect(result.revisionOccurred).toBe(false);
    expect(result.performed).toBe(true);
  });

  it('a found weakness sets revisionOccurred and reports untested, never survived', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ foundGenuineWeakness: true, weaknessDescription: 'a real confound' }) } },
    ]);
    const result = unwrapOk(
      await runAdversarialTest(
        'claim',
        [origin('o1', 'content')],
        [grade('contemporaneous_record')],
        [diag('consistent')],
        llm,
      ),
    );
    expect(result.status).toBe('untested');
    expect(result.revisionOccurred).toBe(true);
    // The distinction the ledger's steelman record depends on: the test DID run.
    expect(result.performed).toBe(true);
  });

  it('picks the best-graded origin as the lead, not just the first one', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } }]);
    await runAdversarialTest(
      'claim',
      [origin('weak', 'weak content'), origin('strong', 'strong content')],
      [grade('testimony'), grade('physical_documentary')],
      [diag('consistent'), diag('consistent')],
      llm,
    );
    expect(llm.receivedPrompts[0]).toContain('strong content');
    expect(llm.receivedPrompts[0]).not.toContain('weak content');
  });

  it('prefers a line that bears on the claim over a higher-graded line marked not_applicable', async () => {
    // Regression test for a live run on "The Great Wall of China is visible from
    // space with the naked eye.", where the lead selected was a NASA instrument
    // image graded physical_documentary but marked not_applicable against the
    // claim, so the steelman attacked evidence with no bearing on it.
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } }]);
    await runAdversarialTest(
      'claim',
      [origin('irrelevant', 'irrelevant content'), origin('bearing', 'bearing content')],
      [grade('physical_documentary'), grade('testimony')],
      [diag('not_applicable'), diag('inconsistent')],
      llm,
    );
    expect(llm.receivedPrompts[0]).toContain('bearing content');
    expect(llm.receivedPrompts[0]).not.toContain('irrelevant content');
  });

  it('still picks the best-graded line when every candidate bears on the claim', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } }]);
    await runAdversarialTest(
      'claim',
      [origin('lesser', 'lesser content'), origin('better', 'better content')],
      [grade('testimony'), grade('physical_documentary')],
      [diag('inconsistent'), diag('consistent')],
      llm,
    );
    expect(llm.receivedPrompts[0]).toContain('better content');
  });
});
