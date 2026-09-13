import { describe, it, expect } from 'vitest';
import { classifyDomain, SEED_REGISTRY } from '../registry.js';
import { gradeOrigin } from '../grade.js';
import { MockLlmClient } from '../llm-client.js';
import type { RetrievedOrigin } from '../types.js';

describe('structural registry (FR-037, FR-039)', () => {
  it('classifies a known seed-listed aggregator domain correctly', () => {
    expect(classifyDomain('https://news.google.com/some/article')).toBe('aggregator');
  });

  it('classifies a known preprint domain correctly', () => {
    expect(classifyDomain('https://arxiv.org/abs/1234.5678')).toBe('preprint');
  });

  it('classifies a subdomain of a registered domain the same as the parent', () => {
    expect(classifyDomain('https://static.arxiv.org/pdf/1234')).toBe('preprint');
  });

  it('classifies an unlisted domain as null — treated as an original source', () => {
    expect(classifyDomain('https://some-random-blog.example.com/post')).toBeNull();
  });

  it('returns null for a malformed URL rather than throwing', () => {
    expect(classifyDomain('not a url at all')).toBeNull();
  });

  it('every seed entry is a real, well-formed domain string with a note', () => {
    for (const entry of SEED_REGISTRY) {
      expect(entry.domain.length).toBeGreaterThan(0);
      expect(entry.note.length).toBeGreaterThan(0);
    }
  });
});

describe('aggregator trace-through in grading (FR-038, SC-009)', () => {
  function aggregatorOrigin(): RetrievedOrigin {
    return {
      id: 'o1',
      candidate: { url: 'https://news.google.com/some/article', title: '', foundVia: 'test' },
      fetch: { requestedUrl: '', finalUrl: null, succeeded: true, httpStatus: 200, contentHash: null, fetchedAt: '' },
      content: 'Reuters reports that the event occurred yesterday.',
      registryClass: 'aggregator',
    };
  }

  it('tells the grading call explicitly when an origin is a known aggregator', async () => {
    const llm = new MockLlmClient([
      {
        generate: {
          text: JSON.stringify({
            startingGrade: 'testimony',
            firedTriggers: [],
            interestedParty: false,
            partyControlledCreationAfterStakesVisible: false,
            sourceReliabilityGrade: 'Unknown',
          }),
        },
      },
    ]);
    await gradeOrigin(aggregatorOrigin(), llm);
    expect(llm.receivedPrompts[0]).toContain('AGGREGATOR');
  });
});
