import { describe, it, expect } from 'vitest';
import { parseClaimRecord, ClaimRecordError } from '../claim-record.js';

const doc = (fm: string, body = 'Some prose.') => `---\n${fm}\n---\n\n${body}\n`;
const VALID = 'corpusSchemaVersion: 0.1.0\nclaimKind: claim\ncanonicalRestatement: |\n  The sky is blue.';

describe('claim record validation (contracts/claim-record.md)', () => {
  it('parses a minimal valid record', () => {
    const r = parseClaimRecord(doc(VALID), 'claim.md');
    expect(r.claimKind).toBe('claim');
    expect(r.canonicalRestatement).toBe('The sky is blue.');
    expect(r.aliases).toEqual([]);
    expect(r.body).toBe('Some prose.');
  });

  describe('FR-012: engine-computed fields are refused, never ignored', () => {
    for (const field of ['band', 'qualifier', 'verdict', 'tree', 'engineVersion', 'cappingConditions']) {
      it(`refuses "${field}" and names it`, () => {
        try {
          parseClaimRecord(doc(`${VALID}\n${field}: established`), 'claim.md');
          expect.unreachable('should have thrown');
        } catch (err) {
          expect(err).toBeInstanceOf(ClaimRecordError);
          expect((err as ClaimRecordError).field).toBe(field);
          expect((err as Error).message).toMatch(/computed by the rule engine/);
        }
      });
    }

    it('does not silently drop an authored band (SC-006)', () => {
      // The distinction that matters: a dropped field looks accepted. Anyone
      // who wrote it would reasonably believe it had taken effect.
      expect(() => parseClaimRecord(doc(`${VALID}\nband: established`), 'claim.md')).toThrow();
    });
  });

  it('refuses an unknown field rather than ignoring it', () => {
    expect(() => parseClaimRecord(doc(`${VALID}\nauthor: someone`), 'claim.md')).toThrow(/unknown field/);
  });

  it('refuses an unsupported corpus schema version', () => {
    const fm = 'corpusSchemaVersion: 9.9.9\nclaimKind: claim\ncanonicalRestatement: |\n  X.';
    expect(() => parseClaimRecord(doc(fm), 'claim.md')).toThrow(/unsupported corpus schema version/);
  });

  describe('claimKind rules', () => {
    it('requires a restatement on a claim', () => {
      expect(() => parseClaimRecord(doc('corpusSchemaVersion: 0.1.0\nclaimKind: claim'), 'claim.md')).toThrow(
        /requires canonicalRestatement/,
      );
    });

    it('forbids a restatement on a rejection (research.md §6)', () => {
      const fm = 'corpusSchemaVersion: 0.1.0\nclaimKind: rejection\ncanonicalRestatement: |\n  Something about a private person.';
      expect(() => parseClaimRecord(doc(fm), 'claim.md')).toThrow(/must not carry canonicalRestatement/);
    });

    it('accepts a rejection with no restatement', () => {
      const r = parseClaimRecord(doc('corpusSchemaVersion: 0.1.0\nclaimKind: rejection'), 'claim.md');
      expect(r.claimKind).toBe('rejection');
      expect(r.canonicalRestatement).toBeUndefined();
    });
  });

  describe('relationship fields', () => {
    it('accepts parentClaim with edgeType', () => {
      const r = parseClaimRecord(doc(`${VALID}\nparentClaim: other-abc12345\nedgeType: load_bearing`), 'claim.md');
      expect(r.parentClaim).toBe('other-abc12345');
      expect(r.edgeType).toBe('load_bearing');
    });

    it('refuses parentClaim without edgeType', () => {
      expect(() => parseClaimRecord(doc(`${VALID}\nparentClaim: other-abc12345`), 'claim.md')).toThrow(
        /must both be present or both absent/,
      );
    });

    it('refuses edgeType without parentClaim', () => {
      expect(() => parseClaimRecord(doc(`${VALID}\nedgeType: load_bearing`), 'claim.md')).toThrow(
        /must both be present or both absent/,
      );
    });

    it('refuses an edgeType outside the constitution vocabulary (FR-006)', () => {
      expect(() =>
        parseClaimRecord(doc(`${VALID}\nparentClaim: other-abc12345\nedgeType: supersedes`), 'claim.md'),
      ).toThrow();
    });

    it('refuses supersedes without a human confirmation (FR-007b)', () => {
      expect(() => parseClaimRecord(doc(`${VALID}\nsupersedes: old-abc12345`), 'claim.md')).toThrow(
        /requires supersedesConfirmedBy/,
      );
    });

    it('accepts supersedes with confirmation', () => {
      const r = parseClaimRecord(doc(`${VALID}\nsupersedes: old-abc12345\nsupersedesConfirmedBy: josh`), 'claim.md');
      expect(r.supersedes).toBe('old-abc12345');
      expect(r.supersedesConfirmedBy).toBe('josh');
    });
  });

  it('parses aliases as a list', () => {
    const r = parseClaimRecord(doc(`${VALID}\naliases:\n  - the sky appears blue\n  - why is the sky blue`), 'claim.md');
    expect(r.aliases).toEqual(['the sky appears blue', 'why is the sky blue']);
  });
});
