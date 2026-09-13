import { describe, it, expect } from 'vitest';
import { MockLlmClient } from '../llm-client.js';
import { markDiagnosticity } from '../diagnosticity.js';
import type { RetrievedOrigin, RivalHypothesis } from '../types.js';

function retrieved(content: string | null): RetrievedOrigin {
  return {
    id: 'o1',
    candidate: { url: 'https://example.com/x', title: '', foundVia: 'test' },
    fetch: {
      requestedUrl: 'https://example.com/x',
      finalUrl: 'https://example.com/x',
      succeeded: content !== null,
      httpStatus: 200,
      contentHash: null,
      fetchedAt: new Date().toISOString(),
    },
    content,
    registryClass: null,
  };
}

describe('diagnosticity (FR-026, FR-027, FR-030)', () => {
  it('marks consistent when the LLM says consistent', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ claim: 'consistent', rivals: {} }) } }]);
    const result = await markDiagnosticity(retrieved('supporting content'), 'The sky is blue', [], llm);
    expect(result.markAgainstClaim).toBe('consistent');
  });

  it('marks inconsistent when the LLM says inconsistent', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ claim: 'inconsistent', rivals: {} }) } }]);
    const result = await markDiagnosticity(retrieved('contradicting content'), 'The sky is green', [], llm);
    expect(result.markAgainstClaim).toBe('inconsistent');
  });

  it('never leaves a surviving origin unmarked — defaults to not_applicable if the response omits it', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ rivals: {} }) } }]);
    const result = await markDiagnosticity(retrieved('content'), 'some claim', [], llm);
    expect(result.markAgainstClaim).toBe('not_applicable');
  });

  it('returns not_applicable without an LLM call when the origin has no content', async () => {
    const llm = new MockLlmClient([]);
    const result = await markDiagnosticity(retrieved(null), 'some claim', [], llm);
    expect(result.markAgainstClaim).toBe('not_applicable');
    expect(llm.receivedPrompts.length).toBe(0);
  });

  it('marks every surviving origin against every proposed rival too (FR-030)', async () => {
    const rivals: RivalHypothesis[] = [
      { id: 'r1', description: 'alternative explanation A', plausibilityRelativeToClaim: 'less_or_equally_plausible' },
      { id: 'r2', description: 'alternative explanation B', plausibilityRelativeToClaim: 'less_or_equally_plausible' },
    ];
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ claim: 'consistent', rivals: { r1: 'inconsistent', r2: 'not_applicable' } }) } },
    ]);
    const result = await markDiagnosticity(retrieved('content'), 'claim', rivals, llm);
    expect(result.marksAgainstRivals.r1).toBe('inconsistent');
    expect(result.marksAgainstRivals.r2).toBe('not_applicable');
  });
});
