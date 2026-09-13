import { describe, it, expect } from 'vitest';
import { MockLlmClient } from '../llm-client.js';
import { discoverCandidates } from '../search.js';

describe('search (FR-011, FR-015, FR-016)', () => {
  it('stops once 2 distinct-domain candidates are found', async () => {
    const llm = new MockLlmClient([
      { generateWithSearch: { text: 'found one', groundingUrls: ['https://a.example.com/x'] } },
      { generateWithSearch: { text: 'found another', groundingUrls: ['https://b.example.com/y'] } },
    ]);
    const candidates = await discoverCandidates('some claim', llm);
    expect(candidates.length).toBe(2);
    expect(llm.receivedPrompts.length).toBe(2); // stopped immediately after reaching the threshold
  });

  it('stops after N consecutive empty attempts when nothing new is found', async () => {
    const llm = new MockLlmClient([
      { generateWithSearch: { text: 'nothing', groundingUrls: [] } },
      { generateWithSearch: { text: 'nothing', groundingUrls: [] } },
      { generateWithSearch: { text: 'nothing', groundingUrls: [] } },
    ]);
    const candidates = await discoverCandidates('an obscure claim', llm);
    expect(candidates.length).toBe(0);
    expect(llm.receivedPrompts.length).toBe(3);
  });

  it('returns an empty array rather than fabricating a source when nothing is found', async () => {
    const llm = new MockLlmClient([
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
    ]);
    const candidates = await discoverCandidates('nothing exists about this', llm);
    expect(candidates).toEqual([]);
  });

  it('does not double-count the same URL found again on a later attempt', async () => {
    const llm = new MockLlmClient([
      { generateWithSearch: { text: '', groundingUrls: ['https://a.example.com/x'] } },
      { generateWithSearch: { text: '', groundingUrls: ['https://a.example.com/x'] } }, // same URL again
      { generateWithSearch: { text: '', groundingUrls: [] } },
      { generateWithSearch: { text: '', groundingUrls: [] } },
    ]);
    const candidates = await discoverCandidates('claim', llm);
    expect(candidates.length).toBe(1);
  });
});
