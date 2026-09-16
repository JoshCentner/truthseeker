import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readClaim, listClaimIds } from '../corpus.js';
import { renderClaimPage } from '../render-claim.js';
import { lookup, has, allTerms } from '../vocabulary.js';

const GREAT_WALL = 'the-great-wall-of-china-is-visible-from-space-3df4fb19';

let page: string;
let doc: Document;

beforeAll(() => {
  page = renderClaimPage(readClaim('corpus', GREAT_WALL), { generatedAt: '2026-01-01T00:00:00.000Z' });
  doc = new JSDOM(page).window.document;
});

describe('the rendered claim page', () => {
  describe('the verdict (FR-014, FR-015)', () => {
    it('shows the band as a word', () => {
      expect(doc.querySelector('.verdict-band')?.textContent).toBe('Refuted');
    });

    it('shows the band definition in the same view, not only in the glossary', () => {
      const definition = doc.querySelector('.verdict-definition')?.textContent ?? '';
      expect(definition).toBe(lookup('refuted').definition);
    });

    it('shows no numeric score, percentage or confidence value anywhere (SC-003)', () => {
      const body = doc.body.textContent ?? '';
      expect(body).not.toMatch(/\b\d{1,3}\s?%/); // percentages
      expect(body).not.toMatch(/confidence[^.]{0,20}\b0?\.\d+/i); // "confidence 0.82"
      expect(body).not.toMatch(/\bscores?\b[^.]{0,12}\b\d/i); // "score: 7", "score of 4"
      expect(body).not.toMatch(/\b\d+\s*(?:\/|out of)\s*\d+\b/i); // "7/10", "4 out of 5"
      // The word "score" itself is permitted in exactly one place: the sentence
      // stating that the band carries none. Asserting its absence outright would
      // forbid the page from saying so.
      expect(body).toMatch(/carries no score or percentage/);
    });

    it('states that the engine, not a model, assigned the band (Principle I)', () => {
      expect(doc.body.textContent).toMatch(/engine assigns the band|no model chooses it/i);
    });
  });

  describe('the evidence ledger (FR-016, FR-017, FR-027, SC-002)', () => {
    it('lists every origin from the ledger with its URL', () => {
      const claim = readClaim('corpus', GREAT_WALL);
      const origins = claim.runs[0]!.ledger!.origins;
      expect(origins.length).toBeGreaterThan(0);
      for (const origin of origins) {
        expect(page, origin.id).toContain(origin.id.replace(/&/g, '&amp;'));
      }
    });

    it('keeps origins that could not be retrieved on the page (FR-027)', () => {
      const claim = readClaim('corpus', GREAT_WALL);
      const unretrieved = claim.runs[0]!.ledger!.origins.filter((o) => o.retrievalStatus === 'could_not_retrieve');
      expect(unretrieved.length).toBeGreaterThan(0);
      expect(doc.body.textContent).toContain('Could not retrieve');
    });

    it('separates supporting, contradicting and irrelevant lines (FR-017)', () => {
      const labels = Array.from(doc.querySelectorAll('.group-label')).map((n) => n.textContent ?? '');
      expect(labels.join(' ')).toMatch(/Contradicts the claim/);
      expect(labels.join(' ')).toMatch(/Bears on neither/);
    });

    it('states that a line bearing on neither counts toward nothing', () => {
      expect(doc.body.textContent).toMatch(/counts? toward nothing/i);
    });
  });

  describe('the process view (FR-020, SC-004)', () => {
    it('lists every step in order', () => {
      const claim = readClaim('corpus', GREAT_WALL);
      for (const step of claim.runs[0]!.trace!.steps) {
        expect(doc.body.textContent, step.step).toContain(step.step);
      }
    });

    it('lists every remediation attempt, including any that failed', () => {
      const claim = readClaim('corpus', GREAT_WALL);
      const attempts = claim.runs[0]!.trace!.remediationAttempts;
      expect(attempts.length).toBeGreaterThan(0);
      const rendered = doc.querySelectorAll('ol.trace li').length;
      expect(rendered).toBeGreaterThanOrEqual(attempts.length);
    });

    it('is in the document rather than behind a disclosure control (Principle III)', () => {
      expect(doc.querySelectorAll('details').length).toBe(0);
      expect(doc.body.textContent).toMatch(/How the run proceeded/);
    });
  });

  describe('provenance (FR-021, FR-022, SC-005)', () => {
    it('shows the blindness caveat without interaction', () => {
      expect(doc.body.textContent).toMatch(/not a protocol-clean run/i);
    });

    it('names the provenance stamps the record does not carry (research.md §7)', () => {
      expect(doc.body.textContent).toMatch(/protocol version and a registry version/i);
    });

    it('shows run id, models and engine version', () => {
      const text = doc.body.textContent ?? '';
      expect(text).toContain('claude-opus-5-manual-chat');
      expect(text).toMatch(/0\.2\.0/);
    });
  });

  describe('authored versus generated (FR-013)', () => {
    it('marks contributor prose as authored', () => {
      const authored = doc.querySelectorAll('.authored');
      expect(authored.length).toBeGreaterThan(0);
      expect(doc.body.textContent).toMatch(/Written by a contributor/);
    });
  });

  describe('the glossary (FR-015a, FR-015b, SC-001c)', () => {
    it('defines every protocol term it renders', () => {
      const dts = Array.from(doc.querySelectorAll('.glossary dt')).map((n) => n.textContent ?? '');
      expect(dts.length).toBeGreaterThan(0);
      // Each entry is "Plain wording (protocol_term)" — both halves present.
      for (const dt of dts) expect(dt, dt).toMatch(/\(.+\)$/);
    });

    it('shows the protocol term alongside plain language, never instead of it', () => {
      // A challenge has to be able to cite the exact field, so the raw term
      // must survive on the page.
      expect(page).toContain('(physical_documentary)');
      expect(page).toContain('(inconsistent)');
    });

    it('covers every term the page actually uses', () => {
      const glossaryTerms = new Set(
        Array.from(doc.querySelectorAll('.glossary dt')).map((n) => (/\(([^)]+)\)$/.exec(n.textContent ?? '') ?? [])[1]),
      );
      const rendered = Array.from(doc.querySelectorAll('.term-code')).map((n) =>
        (n.textContent ?? '').replace(/[()]/g, ''),
      );
      for (const term of rendered) {
        if (has(term)) expect(glossaryTerms.has(term), `${term} rendered but not in glossary`).toBe(true);
      }
    });
  });

  it('is responsive: declares a viewport and no fixed pixel width wider than a phone', () => {
    expect(page).toContain('width=device-width');
    const widths = [...page.matchAll(/min-width:\s*(\d+)px/g)].map((m) => Number(m[1]));
    for (const w of widths) expect(w).toBeLessThanOrEqual(400);
  });
});

describe('vocabulary coverage (SC-001c)', () => {
  it('every vocabulary entry carries plain wording and a definition', () => {
    for (const t of allTerms()) {
      expect(t.plain.length, t.term).toBeGreaterThan(0);
      expect(t.definition.length, t.term).toBeGreaterThan(20);
    }
  });

  it('throws rather than printing a bare identifier for an unknown term', () => {
    expect(() => lookup('not_a_real_term')).toThrow(/No plain-language definition/);
  });

  it('covers every term used by every claim in the real corpus', () => {
    // The guarantee that matters: adding a claim whose ledger uses a term
    // nobody has worded yet fails generation rather than shipping a page with
    // an unexplained identifier on it.
    for (const id of listClaimIds('corpus')) {
      const claim = readClaim('corpus', id);
      expect(() => renderClaimPage(claim, { generatedAt: '2026-01-01T00:00:00.000Z' }), id).not.toThrow();
    }
  });
});
