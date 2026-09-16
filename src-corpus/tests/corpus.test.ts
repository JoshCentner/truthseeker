import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readClaim, listClaimIds, CorpusError } from '../corpus.js';
import { claimIdFor } from '../identity.js';
import { CORPUS_SCHEMA_VERSION } from '../claim-record.js';

let root: string;

function writeClaim(restatement: string, extraFrontmatter = '', body = 'Prose.'): string {
  const id = claimIdFor(restatement);
  const dir = path.join(root, 'claims', id);
  fs.mkdirSync(dir, { recursive: true });
  const fm = [
    '---',
    `corpusSchemaVersion: ${CORPUS_SCHEMA_VERSION}`,
    'claimKind: claim',
    'canonicalRestatement: |',
    `  ${restatement}`,
    ...(extraFrontmatter ? [extraFrontmatter] : []),
    '---',
    '',
    body,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'claim.md'), fm);
  return id;
}

function writeRun(id: string, runId: string, record: unknown): void {
  const dir = path.join(root, 'claims', id, 'runs');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${runId}.json`), JSON.stringify(record, null, 2));
}

function completedRecord(claimText: string, band = 'refuted'): unknown {
  return {
    result: {
      kind: 'completed',
      ledger: { claimRestatement: claimText, origins: [], warrants: [], rivals: [], diagnosticityEntries: [] },
      trace: { runId: 'r1', requester: null, modelIds: ['m'], startedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T00:01:00Z', steps: [], remediationAttempts: [] },
    },
    verdict: { band, qualifier: null, tree: 'tree1_simple_factual', conditionsMet: [], cappingConditions: [], engineVersion: '0.2.0', schemaVersion: '0.1.0' },
    provenance: { recordedAt: '2026-01-01T00:02:00Z' },
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-test-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('corpus reading', () => {
  it('reads a valid claim with its prose', () => {
    const id = writeClaim('The sky is blue.');
    const claim = readClaim(root, id);
    expect(claim.record.canonicalRestatement).toBe('The sky is blue.');
    expect(claim.record.body).toBe('Prose.');
    expect(claim.runs).toEqual([]);
  });

  it('collects supplementary markdown files in filename order (FR-004)', () => {
    const id = writeClaim('The sky is blue.');
    const dir = path.join(root, 'claims', id);
    fs.writeFileSync(path.join(dir, 'zeta.md'), 'last');
    fs.writeFileSync(path.join(dir, 'alpha.md'), 'first');
    const claim = readClaim(root, id);
    expect(claim.supplementary.map((s) => s.filename)).toEqual(['alpha.md', 'zeta.md']);
  });

  it('lists claim ids sorted, never in filesystem order (research.md §8)', () => {
    writeClaim('Zebra claim.');
    writeClaim('Alpha claim.');
    const ids = listClaimIds(root);
    expect([...ids].sort()).toEqual(ids);
  });

  describe('refusals', () => {
    it('refuses a nested claim directory (FR-002)', () => {
      const id = writeClaim('The sky is blue.');
      fs.mkdirSync(path.join(root, 'claims', id, 'sub-claim'), { recursive: true });
      expect(() => readClaim(root, id)).toThrow(/nested directory/);
    });

    it('refuses a claim whose restatement was edited after the fact (FR-007a, SC-007a)', () => {
      const id = writeClaim('The sky is blue.');
      // Simulate someone fixing a "typo": the directory no longer matches.
      const file = path.join(root, 'claims', id, 'claim.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf-8').replace('The sky is blue.', 'The sky is blue!'));
      expect(() => readClaim(root, id)).toThrow(/does not match its canonical restatement/);
    });

    it('names the id the edited restatement would derive, so the fix is obvious', () => {
      const id = writeClaim('The sky is blue.');
      const file = path.join(root, 'claims', id, 'claim.md');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf-8').replace('The sky is blue.', 'The sky is blue!'));
      expect(() => readClaim(root, id)).toThrow(new RegExp(claimIdFor('The sky is blue!')));
    });

    it('refuses a run whose claim text differs from the claim (FR-007d)', () => {
      const id = writeClaim('The sky is blue.');
      writeRun(id, 'r1', completedRecord('The sky is green.'));
      expect(() => readClaim(root, id)).toThrow(/executed against a different claim text/);
    });

    it('refuses an auth_failed record (FR-009b)', () => {
      const id = writeClaim('The sky is blue.');
      writeRun(id, 'r1', { result: { kind: 'auth_failed' }, provenance: {} });
      expect(() => readClaim(root, id)).toThrow(/must not be stored in the corpus/);
    });

    it('refuses malformed JSON naming the file', () => {
      const id = writeClaim('The sky is blue.');
      const dir = path.join(root, 'claims', id, 'runs');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'broken.json'), '{not json');
      expect(() => readClaim(root, id)).toThrow(/broken\.json/);
    });

    it('refuses a missing claim', () => {
      expect(() => readClaim(root, 'nope-12345678')).toThrow(CorpusError);
    });
  });

  describe('runs without a verdict (FR-009a, FR-013a)', () => {
    it('reads a harm-gate rejection and surfaces the rule that fired', () => {
      const dir = path.join(root, 'claims', 'rejected-abc123');
      fs.mkdirSync(path.join(dir, 'runs'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'claim.md'),
        `---\ncorpusSchemaVersion: ${CORPUS_SCHEMA_VERSION}\nclaimKind: rejection\n---\n\nRejected at intake.\n`,
      );
      fs.writeFileSync(
        path.join(dir, 'runs', 'r1.json'),
        JSON.stringify({ result: { kind: 'rejected', rule: 'names a private individual' }, provenance: { runId: 'r1', recordedAt: '2026-01-01T00:00:00Z' } }),
      );
      const claim = readClaim(root, 'rejected-abc123');
      expect(claim.runs[0]!.kind).toBe('rejected');
      expect(claim.runs[0]!.outcome!.detail.join(' ')).toMatch(/names a private individual/);
    });

    it('reads a needs_clarification run with its outstanding questions', () => {
      const id = writeClaim('The sky is blue.');
      writeRun(id, 'r1', {
        result: { kind: 'needs_clarification', step: 'grade', questions: ['which source?'] },
        provenance: { runId: 'r1', recordedAt: '2026-01-01T00:00:00Z' },
      });
      const claim = readClaim(root, id);
      expect(claim.runs[0]!.outcome!.detail.join(' ')).toMatch(/which source\?/);
    });
  });

  it('orders runs newest first with a stable tiebreak', () => {
    const id = writeClaim('The sky is blue.');
    const older = completedRecord('The sky is blue.') as { provenance: { recordedAt: string } };
    writeRun(id, 'older', { ...older, provenance: { recordedAt: '2026-01-01T00:00:00Z' } });
    writeRun(id, 'newer', { ...older, provenance: { recordedAt: '2026-06-01T00:00:00Z' } });
    const claim = readClaim(root, id);
    expect(claim.runs[0]!.file).toMatch(/newer/);
  });
});

describe('the real migrated corpus', () => {
  it('reads every claim without error', () => {
    const ids = listClaimIds('corpus');
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(() => readClaim('corpus', id), id).not.toThrow();
    }
  });

  it('has a run record for each claim whose text matches its restatement', () => {
    for (const id of listClaimIds('corpus')) {
      const claim = readClaim('corpus', id);
      expect(claim.runs.length, id).toBeGreaterThan(0);
    }
  });
});
