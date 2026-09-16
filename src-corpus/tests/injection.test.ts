import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { readClaim } from '../corpus.js';
import { renderClaimPage } from '../render-claim.js';

/**
 * SC-003a. The fixture's authored Markdown and its run-record strings are both
 * stuffed with script tags, event-handler attributes and javascript: URLs. This
 * is the test that decides whether research.md §2's escape-at-the-boundary
 * design actually holds.
 *
 * The assertions parse the page with a real HTML parser rather than grepping
 * the source, because the question is not "does the string 'javascript:' appear
 * anywhere" — of course it does, the page displays a hostile source's URL so a
 * reader can audit it. The question is what a BROWSER builds from these bytes:
 * which elements exist, and what attributes they carry. Escaped text that reads
 * as an attack is exactly the desired outcome; markup that IS one is the
 * failure.
 */

const CORPUS = 'src-corpus/tests/fixtures/hostile';
const ID = 'a-hostile-claim-used-to-exercise-escaping-86069946';

let page: string;
let dom: JSDOM;
let doc: Document;

beforeAll(() => {
  page = renderClaimPage(readClaim(CORPUS, ID), { generatedAt: '2026-01-01T00:00:00.000Z' });
  dom = new JSDOM(page);
  doc = dom.window.document;
});

describe('a hostile corpus renders an inert page (SC-003a, FR-027a-d)', () => {
  it('parses to a document containing no executable or embedding element', () => {
    for (const tag of ['script', 'iframe', 'object', 'embed', 'img', 'svg', 'form', 'link', 'base']) {
      expect(doc.querySelectorAll(tag).length, `<${tag}> present`).toBe(0);
    }
  });

  it('has no element carrying an event-handler attribute', () => {
    const offenders: string[] = [];
    for (const element of Array.from(doc.querySelectorAll('*'))) {
      for (const attr of Array.from(element.attributes)) {
        if (/^on/i.test(attr.name)) offenders.push(`<${element.tagName.toLowerCase()} ${attr.name}>`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no element carrying a resource-loading attribute', () => {
    const offenders: string[] = [];
    for (const element of Array.from(doc.querySelectorAll('*'))) {
      for (const attr of Array.from(element.attributes)) {
        if (['src', 'srcset', 'data', 'poster', 'formaction', 'background'].includes(attr.name.toLowerCase())) {
          offenders.push(`<${element.tagName.toLowerCase()} ${attr.name}>`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no anchor with a scheme other than http or https', () => {
    const bad = Array.from(doc.querySelectorAll('a'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => !/^https?:\/\//i.test(href));
    expect(bad).toEqual([]);
  });

  it('renders every attack payload as visible text rather than dropping it', () => {
    // Neutralised, not censored. Someone auditing a hostile source has to be
    // able to see what that source actually contained.
    const body = doc.body.textContent ?? '';
    expect(body).toContain('alert(1)');
    expect(body).toContain('javascript:alert(document.cookie)');
    expect(body).toContain('violation text');
    expect(body).toContain('Mechanism containing');
    expect(body).toContain('A rival described with');
    expect(body).toContain('Caveat containing');
  });

  it('renders the javascript: origin as inert text, not as a link', () => {
    expect(doc.querySelectorAll('.inert-link').length).toBeGreaterThan(0);
  });

  it('keeps a could-not-retrieve origin on the page rather than hiding it (FR-027)', () => {
    expect(doc.body.textContent).toContain('Could not retrieve');
  });

  it('shows the blindness caveat without any interaction (SC-005)', () => {
    // No <details>, no toggle: the caveat is in the document body as plain text.
    expect(doc.querySelectorAll('details').length).toBe(0);
    expect(doc.body.textContent).toContain('Caveat containing');
  });

  it('is a complete, well-formed document', () => {
    expect(page.startsWith('<!doctype html>')).toBe(true);
    expect(doc.querySelector('main')).not.toBeNull();
  });

  it('carries no inline style attribute, so the only CSS is the one this project authored', () => {
    const styled = Array.from(doc.querySelectorAll('[style]'));
    expect(styled.length).toBe(0);
  });
});
