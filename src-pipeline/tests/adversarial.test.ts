import { describe, it, expect } from 'vitest';
import { runAdversarialTest } from '../adversarial.js';
import { MockLlmClient } from '../llm-client.js';
import type { RetrievedOrigin, GradingOutput } from '../types.js';
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

describe('adversarial testing (FR-031, FR-032)', () => {
  it("'untested' is the honest default when nothing survived grading — no LLM call made", async () => {
    const llm = new MockLlmClient([]);
    const result = unwrapOk(await runAdversarialTest('claim', [origin('o1', 'content')], [grade('assertion')], llm));
    expect(result.status).toBe('untested');
    expect(result.revisionOccurred).toBe(false);
    expect(llm.receivedPrompts.length).toBe(0);
  });

  it("'untested' when there are no origins at all", async () => {
    const llm = new MockLlmClient([]);
    const result = unwrapOk(await runAdversarialTest('claim', [], [], llm));
    expect(result.status).toBe('untested');
  });

  it("'survived' requires a completed test that found no genuine weakness", async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } }]);
    const result = unwrapOk(await runAdversarialTest('claim', [origin('o1', 'strong content')], [grade('physical_documentary')], llm));
    expect(result.status).toBe('survived');
    expect(result.revisionOccurred).toBe(false);
  });

  it('a found weakness sets revisionOccurred and reports untested, never survived', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ foundGenuineWeakness: true, weaknessDescription: 'a real confound' }) } },
    ]);
    const result = unwrapOk(await runAdversarialTest('claim', [origin('o1', 'content')], [grade('contemporaneous_record')], llm));
    expect(result.status).toBe('untested');
    expect(result.revisionOccurred).toBe(true);
  });

  it('picks the best-graded origin as the lead, not just the first one', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ foundGenuineWeakness: false, weaknessDescription: '' }) } }]);
    await runAdversarialTest(
      'claim',
      [origin('weak', 'weak content'), origin('strong', 'strong content')],
      [grade('testimony'), grade('physical_documentary')],
      llm,
    );
    expect(llm.receivedPrompts[0]).toContain('strong content');
    expect(llm.receivedPrompts[0]).not.toContain('weak content');
  });
});
