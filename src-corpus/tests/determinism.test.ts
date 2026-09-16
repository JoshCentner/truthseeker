import { describe, it, expect, vi, afterEach } from 'vitest';
import { readClaim, listClaimIds } from '../corpus.js';
import { renderClaimPage } from '../render-claim.js';

const GREAT_WALL = 'the-great-wall-of-china-is-visible-from-space-3df4fb19';
const STAMP = '2026-01-01T00:00:00.000Z';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('deterministic generation (SC-010, FR-030, research.md §8)', () => {
  it('produces byte-identical output for an unchanged corpus', () => {
    const a = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
    const b = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
    expect(a).toBe(b);
  });

  it('differs only in the generation timestamp when that changes', () => {
    const a = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
    const b = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: '2027-06-15T12:34:56.000Z' });
    expect(a).not.toBe(b);
    // Exactly one line should differ. If more do, something else is varying
    // with time and the "diff is reviewable" property is gone.
    const aLines = a.split('\n');
    const bLines = b.split('\n');
    expect(aLines.length).toBe(bLines.length);
    const differing = aLines.filter((line, i) => line !== bLines[i]);
    expect(differing.length).toBe(1);
  });

  it('stamps exactly one generation time on the page', () => {
    const page = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
    const stamps = page.match(/Generated 2026-01-01 00:00:00 UTC/g) ?? [];
    expect(stamps.length).toBe(1);
  });

  it('renders every claim in the corpus deterministically', () => {
    for (const id of listClaimIds('corpus')) {
      const a = renderClaimPage(readClaim('corpus', id), { generatedAt: STAMP });
      const b = renderClaimPage(readClaim('corpus', id), { generatedAt: STAMP });
      expect(a, id).toBe(b);
    }
  });

  it('does not vary with the host timezone', () => {
    // Dates are formatted as fixed UTC, so a contributor in Auckland and one in
    // Los Angeles regenerate identical bytes. Otherwise every regeneration is a
    // noisy diff and nobody reviews it.
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Auckland';
      const a = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
      process.env.TZ = 'America/Los_Angeles';
      const b = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
      expect(a).toBe(b);
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('the offline guarantee (SC-009, FR-028)', () => {
  it('renders with fetch removed entirely', () => {
    // Not stubbed to reject — removed. If any code path reached for the network
    // it would throw a TypeError rather than quietly awaiting something.
    vi.stubGlobal('fetch', undefined);
    expect(() => renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP })).not.toThrow();
  });

  it('renders with no API key present in the environment', () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(() => renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP })).not.toThrow();
  });

  it('produces a page that itself requests nothing when opened', () => {
    const page = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: STAMP });
    expect(page).not.toMatch(/\ssrc\s*=/i);
    expect(page).not.toMatch(/<link\b/i);
    expect(page).not.toMatch(/@import/i);
    expect(page).not.toMatch(/url\(/i);
  });
});
