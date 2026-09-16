import { describe, it, expect } from 'vitest';
import { parseFrontmatter, FrontmatterError } from '../frontmatter.js';

const fm = (body: string) => parseFrontmatter(`---\n${body}\n---\n\nprose here\n`, 'claim.md');

describe('restricted frontmatter parser (research.md §3)', () => {
  describe('no type coercion — the whole reason this is not YAML', () => {
    it('keeps "no" a string rather than making it false', () => {
      expect(fm('edgeType: no').data.edgeType).toBe('no');
    });

    it('keeps a version-shaped value intact rather than making it a number', () => {
      // Under YAML this becomes 1.2 and loses a digit — in a claim id that is
      // silent corruption of identity.
      expect(fm('parentClaim: 1.20').data.parentClaim).toBe('1.20');
    });

    it('keeps yes/on/off/null as literal strings', () => {
      expect(fm('a: yes').data.a).toBe('yes');
      expect(fm('a: on').data.a).toBe('on');
      expect(fm('a: off').data.a).toBe('off');
      expect(fm('a: null').data.a).toBe('null');
    });

    it('keeps a colon-and-digits value from becoming sexagesimal', () => {
      expect(fm('a: 12:30:45').data.a).toBe('12:30:45');
    });
  });

  describe('supported forms', () => {
    it('parses scalars', () => {
      expect(fm('claimKind: claim').data.claimKind).toBe('claim');
    });

    it('parses block scalars and trims them', () => {
      const r = parseFrontmatter(
        '---\ncanonicalRestatement: |\n  The Great Wall is visible from space.\n---\n\nbody\n',
        'claim.md',
      );
      expect(r.data.canonicalRestatement).toBe('The Great Wall is visible from space.');
    });

    it('parses multi-line block scalars preserving internal newlines', () => {
      const r = parseFrontmatter('---\nnote: |\n  line one\n  line two\n---\n\nbody\n', 'claim.md');
      expect(r.data.note).toBe('line one\nline two');
    });

    it('parses lists', () => {
      const r = parseFrontmatter('---\naliases:\n  - first wording\n  - second wording\n---\n\nbody\n', 'claim.md');
      expect(r.data.aliases).toEqual(['first wording', 'second wording']);
    });

    it('returns the body separately from the frontmatter', () => {
      expect(fm('a: b').body).toBe('prose here');
    });

    it('treats a file with no frontmatter as all body', () => {
      const r = parseFrontmatter('just prose\n', 'notes.md');
      expect(r.data).toEqual({});
      expect(r.body).toBe('just prose');
    });
  });

  describe('everything outside the subset errors with a line number', () => {
    const cases: [string, string, RegExp][] = [
      ['inline array', 'aliases: [a, b]', /inline arrays/],
      ['inline map', 'meta: {a: b}', /inline maps/],
      ['anchor', 'a: &anchor x', /anchors/],
      ['alias', 'a: *anchor', /aliases/],
      ['explicit tag', 'a: !!str 5', /tags/],
      ['comment', '# a comment', /comments are not supported/],
      ['orphan indented line', '  stray: value', /no key opened above it/],
      ['non key-value line', 'not a key value line', /expected "key: value"/],
    ];

    for (const [label, body, pattern] of cases) {
      it(`rejects ${label}`, () => {
        expect(() => fm(body)).toThrow(pattern);
      });
    }

    it('rejects a duplicate key rather than silently taking the last', () => {
      expect(() => fm('a: 1\na: 2')).toThrow(/duplicate key "a"/);
    });

    it('rejects an unterminated frontmatter block', () => {
      expect(() => parseFrontmatter('---\na: b\n', 'claim.md')).toThrow(/never closed/);
    });

    it('rejects an empty block scalar', () => {
      expect(() => fm('a: |')).toThrow(/no indented content/);
    });

    it('rejects a key with neither value nor list items', () => {
      expect(() => fm('a:\nb: c')).toThrow(/no value and no "- item" lines/);
    });

    it('names the file and line in the message', () => {
      try {
        fm('ok: 1\n[bad]');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(FrontmatterError);
        expect((err as FrontmatterError).message).toMatch(/^claim\.md:3:/);
      }
    });
  });
});
