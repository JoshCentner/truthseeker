import { describe, it, expect } from 'vitest';
import { claimIdFor, rejectionIdFor, idMatchesRestatement } from '../identity.js';

describe('claim identity (FR-007, FR-008, research.md §5)', () => {
  it('derives a readable slug plus an 8-character hash', () => {
    const id = claimIdFor('The Great Wall of China is visible from space with the naked eye.');
    expect(id).toMatch(/^the-great-wall-of-china-is-visible-from-space-[0-9a-f]{8}$/);
  });

  it('gives byte-identical restatements identical ids, which is what auto-links them', () => {
    const a = claimIdFor('Vaccines cause autism.');
    const b = claimIdFor('Vaccines cause autism.');
    expect(a).toBe(b);
  });

  it('gives restatements differing only in punctuation different ids', () => {
    // The slug strips punctuation, so only the hash separates these. If the
    // hash were taken over the slug rather than the raw text, these would
    // collide and two different claims would silently merge.
    expect(claimIdFor('Vaccines cause autism.')).not.toBe(claimIdFor('Vaccines cause autism?'));
  });

  it('gives restatements differing only past the truncation point different ids', () => {
    const base = 'A very long claim about something that goes on well past the readable truncation limit';
    expect(claimIdFor(`${base} in one way.`)).not.toBe(claimIdFor(`${base} in another way.`));
  });

  it('truncates the readable part at a hyphen boundary, never mid-word', () => {
    const id = claimIdFor('supercalifragilistic expialidocious antidisestablishmentarianism floccinaucinihilipilification');
    const readable = id.slice(0, id.lastIndexOf('-'));
    expect(readable.length).toBeLessThanOrEqual(48);
    expect(readable.endsWith('-')).toBe(false);
  });

  describe('degrades gracefully on hostile restatements', () => {
    it('handles a non-Latin restatement', () => {
      const id = claimIdFor('長城從太空中用肉眼可見。');
      expect(id).toMatch(/^[0-9a-f]{8}$/); // no readable part survives, hash still identifies it
    });

    it('handles a punctuation-only restatement', () => {
      expect(claimIdFor('!!! ??? ...')).toMatch(/^[0-9a-f]{8}$/);
    });

    it('still distinguishes two different non-Latin restatements', () => {
      expect(claimIdFor('長城從太空中用肉眼可見。')).not.toBe(claimIdFor('長城從太空中不可見。'));
    });

    it('handles path-hostile characters without producing a path', () => {
      const id = claimIdFor('../../etc/passwd is readable');
      expect(id).not.toContain('/');
      expect(id).not.toContain('..');
    });
  });

  describe('rejection ids (research.md §6)', () => {
    it('derives from the run id only, so no claim text leaks into the path', () => {
      expect(rejectionIdFor('run-1234')).toMatch(/^rejected-[0-9a-f]{16}$/);
    });

    it('is stable for a given run id', () => {
      expect(rejectionIdFor('run-1234')).toBe(rejectionIdFor('run-1234'));
    });
  });

  describe('idMatchesRestatement — the immutability check (FR-007a)', () => {
    it('matches when the restatement is unchanged', () => {
      const r = 'The sky is blue.';
      expect(idMatchesRestatement(claimIdFor(r), r)).toBe(true);
    });

    it('fails when the restatement was edited, even by one character', () => {
      const id = claimIdFor('The sky is blue.');
      expect(idMatchesRestatement(id, 'The sky is blue!')).toBe(false);
      expect(idMatchesRestatement(id, 'the sky is blue.')).toBe(false);
    });
  });
});
