import { describe, it, expect } from 'vitest';
import {
  screenSource,
  partitionCandidates,
  assertNoBlockedOrigins,
  findBlockedOrigins,
  BlockedSourceError,
  BLOCKED_REGISTRY_CLASSES,
} from '../source-policy.js';
import { discoverCandidates } from '../search.js';
import { assembleLedger } from '../assemble-ledger.js';
import { MockLlmClient } from '../llm-client.js';
import type { CandidateOrigin, RetrievedOrigin } from '../types.js';

const candidate = (url: string): CandidateOrigin => ({ url, title: '', foundVia: 'test' });

describe('the deterministic source gate (constitution: "no origin\'s domain is classed aggregator")', () => {
  describe('the case that motivated it', () => {
    it('blocks the exact Wikipedia URL that reached a committed record', () => {
      // This URL was graded, marked inconsistent, counted as one of two opposing
      // clusters, and carried a live claim to Refuted before anything checked it.
      const screening = screenSource('https://en.m.wikipedia.org/wiki/Artificial_structures_visible_from_space');
      expect(screening.admitted).toBe(false);
      expect(screening.registryClass).toBe('aggregator');
      expect(screening.reason).toMatch(/aggregator/);
    });

    it('blocks Wikipedia on every language and mobile subdomain', () => {
      for (const url of [
        'https://en.wikipedia.org/wiki/X',
        'https://en.m.wikipedia.org/wiki/X',
        'https://de.wikipedia.org/wiki/X',
        'https://simple.wikipedia.org/wiki/X',
        'https://WIKIPEDIA.ORG/wiki/X',
      ]) {
        expect(screenSource(url).admitted, url).toBe(false);
      }
    });

    it('explains why exclusion rather than down-weighting', () => {
      const reason = screenSource('https://en.wikipedia.org/wiki/X').reason ?? '';
      expect(reason).toMatch(/double-count|pointer to evidence/i);
    });
  });

  describe('what is blocked and what is not', () => {
    it('blocks only the aggregator class', () => {
      expect([...BLOCKED_REGISTRY_CLASSES]).toEqual(['aggregator']);
    });

    it('blocks news aggregators and tertiary reference works alike', () => {
      for (const url of [
        'https://news.google.com/x',
        'https://www.msn.com/x',
        'https://britannica.com/topic/x',
        'https://scholar.google.com/x',
        'https://www.researchgate.net/publication/x',
        'https://somewiki.fandom.com/wiki/X',
      ]) {
        expect(screenSource(url).admitted, url).toBe(false);
      }
    });

    it('admits a press release, which IS the original document for what a body said', () => {
      const s = screenSource('https://www.prnewswire.com/news-releases/x');
      expect(s.admitted).toBe(true);
      expect(s.registryClass).toBe('press_release');
    });

    it('admits a preprint, whose lack of peer review the warrant rubric already handles', () => {
      expect(screenSource('https://arxiv.org/abs/2401.00001').admitted).toBe(true);
    });

    it('admits a paywalled source, since access is not provenance', () => {
      expect(screenSource('https://www.wsj.com/articles/x').admitted).toBe(true);
    });

    it('admits an unregistered domain', () => {
      const s = screenSource('https://pmc.ncbi.nlm.nih.gov/articles/PMC3972694');
      expect(s.admitted).toBe(true);
      expect(s.registryClass).toBeNull();
    });

    it('admits a malformed URL rather than blocking what it cannot classify', () => {
      // Refusing on a parse failure would make the gate a source of false
      // negatives; retrieve.ts will fail to fetch it and record that honestly.
      expect(screenSource('not a url').admitted).toBe(true);
    });
  });

  describe('partitioning at discovery', () => {
    it('separates admitted from excluded and keeps the reason with each', () => {
      const { admitted, excluded } = partitionCandidates([
        candidate('https://en.wikipedia.org/wiki/X'),
        candidate('https://earthobservatory.nasa.gov/images/1455'),
      ]);
      expect(admitted.map((a) => a.url)).toEqual(['https://earthobservatory.nasa.gov/images/1455']);
      expect(excluded.length).toBe(1);
      expect(excluded[0]!.reason).toBeTruthy();
    });
  });

  describe('the search step', () => {
    it('never returns a blocked domain as a candidate, and never fetches one', async () => {
      const llm = new MockLlmClient([
        { generateWithSearch: { text: '', groundingUrls: ['https://en.m.wikipedia.org/wiki/X', 'https://a.example.com/y'] } },
        { generateWithSearch: { text: '', groundingUrls: ['https://b.example.com/z'] } },
      ]);
      const { candidates, excluded } = await discoverCandidates('claim', llm);
      expect(candidates.some((c) => c.url.includes('wikipedia'))).toBe(false);
      expect(excluded.map((e) => e.url)).toEqual(['https://en.m.wikipedia.org/wiki/X']);
    });

    it('treats an attempt that finds only blocked domains as an empty attempt', async () => {
      // Otherwise a search returning nothing but aggregators loops forever
      // against the "found something new" branch.
      const llm = new MockLlmClient([
        { generateWithSearch: { text: '', groundingUrls: ['https://en.wikipedia.org/a'] } },
        { generateWithSearch: { text: '', groundingUrls: ['https://en.wikipedia.org/b'] } },
        { generateWithSearch: { text: '', groundingUrls: ['https://en.wikipedia.org/c'] } },
      ]);
      const { candidates, excluded } = await discoverCandidates('claim', llm);
      expect(candidates).toEqual([]);
      expect(excluded.length).toBe(3);
      expect(llm.receivedPrompts.length).toBe(3); // terminated, did not spin
    });
  });

  describe('the hard gate at ledger assembly', () => {
    const retrieved = (id: string): RetrievedOrigin => ({
      id,
      candidate: candidate(id),
      fetch: { requestedUrl: id, finalUrl: id, succeeded: true, httpStatus: 200, contentHash: 'h', fetchedAt: '' },
      content: 'some content',
      registryClass: null,
    });

    it('throws if a blocked origin reaches assembly by any route', () => {
      expect(() => assertNoBlockedOrigins(['https://en.wikipedia.org/wiki/X'])).toThrow(BlockedSourceError);
    });

    it('catches a blocked source introduced by a hand-written transcript, not just by search', () => {
      // The route the original mistake actually took: the manual-run harness
      // supplied the URL directly as a grounding result, bypassing discovery.
      expect(() =>
        assembleLedger({
          claim: 'A claim.',
          classification: { primary: 'simple_factual', confidence: 'high', isExtraordinary: false },
          origins: [retrieved('https://en.m.wikipedia.org/wiki/Artificial_structures_visible_from_space')],
          grades: [
            {
              startingGrade: 'testimony',
              firedTriggers: [],
              interestedParty: false,
              partyControlledCreationAfterStakesVisible: false,
              sourceReliabilityGrade: 'mixed',
              rawModelReasoning: '',
            },
          ],
          diagnostics: [{ markAgainstClaim: 'inconsistent', marksAgainstRivals: {} }],
          rivals: [],
          adversarialStatus: 'untested',
          steelmanPerformed: false,
          steelmanRevisionOccurred: false,
          extraordinaryClusterSurvivedAdversarialTesting: null,
        }),
      ).toThrow(/aggregator/);
    });

    it('names every offending origin, not only the first', () => {
      try {
        assertNoBlockedOrigins(['https://en.wikipedia.org/a', 'https://news.google.com/b', 'https://ok.example/c']);
        expect.unreachable('should have thrown');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain('wikipedia.org');
        expect(message).toContain('news.google.com');
        expect(message).not.toContain('ok.example');
      }
    });

    it('passes a clean origin list', () => {
      expect(() => assertNoBlockedOrigins(['https://pmc.ncbi.nlm.nih.gov/articles/PMC1', 'https://nasa.gov/x'])).not.toThrow();
    });
  });

  describe('offline re-validation of stored records', () => {
    it('reports rather than throws, so a later registry addition cannot nuke the corpus', () => {
      const found = findBlockedOrigins(['https://en.wikipedia.org/wiki/X', 'https://ok.example/y']);
      expect(found.length).toBe(1);
      expect(found[0]!.url).toContain('wikipedia');
    });

    it('returns nothing for a clean record', () => {
      expect(findBlockedOrigins(['https://ok.example/y'])).toEqual([]);
    });
  });
});
