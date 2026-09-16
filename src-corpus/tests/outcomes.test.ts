import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readClaim } from '../corpus.js';
import { renderClaimPage } from '../render-claim.js';
import { claimIdFor, rejectionIdFor } from '../identity.js';

let root: string;
const STAMP = '2026-01-01T00:00:00.000Z';

function write(dir: string, file: string, contents: string): void {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  fs.writeFileSync(path.join(dir, file), contents);
}

function completedRun(claimText: string, band: string, origins: string[], recordedAt: string): unknown {
  return {
    result: {
      kind: 'completed',
      ledger: {
        schemaVersion: '0.1.0',
        claimRestatement: claimText,
        classification: { primary: 'simple_factual', confidence: 'high' },
        screens: { falsifiability: 'pass', priorPlausibility: 'ordinary' },
        origins: origins.map((id) => ({ id, retrievalStatus: 'retrieved', retracted: false, correctedFormOfId: null })),
        warrants: origins.map((id) => ({
          originId: id, startingGrade: 'testimony', firedTriggers: [], interestedParty: false,
          partyControlledCreationAfterStakesVisible: false, sourceReliabilityGrade: 'not_rated',
          channelKeys: { data: null, method: null, institution: null, motive: null },
        })),
        rivals: [],
        diagnosticityEntries: origins.map((id) => ({ lineOriginId: id, against: 'claim', mark: 'consistent' })),
        adversarialStatus: 'survived',
        silenceFinding: 'none',
        steelman: { performed: true, revisionOccurred: false },
        extraordinaryClusterSurvivedAdversarialTesting: null,
        treeExtension: null,
      },
      trace: { runId: `run-${recordedAt}`, requester: null, modelIds: ['m'], startedAt: recordedAt, completedAt: recordedAt, steps: [], remediationAttempts: [] },
    },
    verdict: {
      band, qualifier: null, tree: 'tree1_simple_factual', conditionsMet: [], cappingConditions: [],
      engineVersion: '0.2.0', schemaVersion: '0.1.0', dependenceMap: [], residue: null, movedBy: null, refusalReason: null,
    },
    provenance: { recordedAt },
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'outcomes-test-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('runs that ended without a verdict (FR-013a)', () => {
  it('a harm-gate rejection publishes the rule that fired and none of the claim (research.md §6)', () => {
    const id = rejectionIdFor('run-abc');
    const dir = path.join(root, 'claims', id);
    write(dir, 'claim.md', '---\ncorpusSchemaVersion: 0.1.0\nclaimKind: rejection\n---\n\nThis claim was refused at intake.\n');
    write(dir, 'runs/run-abc.json', JSON.stringify({
      result: { kind: 'rejected', rule: 'names a private individual and targets their private life' },
      provenance: { runId: 'run-abc', recordedAt: STAMP },
    }));

    const page = renderClaimPage(readClaim(root, id), { generatedAt: STAMP });
    const doc = new JSDOM(page).window.document;
    const text = doc.body.textContent ?? '';

    expect(text).toContain('names a private individual');
    expect(text).toMatch(/no verdict/i);
    // The band must be absent entirely — not empty, not "pending".
    expect(doc.querySelector('.verdict-band')).toBeNull();
    // And the page must not publish the claim itself: the id carries no slug
    // and there is no restatement to leak.
    expect(id).toMatch(/^rejected-[0-9a-f]{16}$/);
    expect(page).not.toMatch(/canonicalRestatement/);
  });

  it('a review hold states why it was queued rather than implying a finding', () => {
    const restatement = 'A borderline claim about a semi-public figure.';
    const id = claimIdFor(restatement);
    const dir = path.join(root, 'claims', id);
    write(dir, 'claim.md', `---\ncorpusSchemaVersion: 0.1.0\nclaimKind: claim\ncanonicalRestatement: |\n  ${restatement}\n---\n\nQueued.\n`);
    write(dir, 'runs/r1.json', JSON.stringify({
      claim: restatement,
      result: { kind: 'needs_review', reason: 'unclear whether the conduct falls inside their public role' },
      provenance: { runId: 'r1', recordedAt: STAMP },
    }));

    const text = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document.body.textContent ?? '';
    expect(text).toContain('unclear whether the conduct falls inside their public role');
    expect(text).toMatch(/not a finding that it is true or false/i);
  });

  it('an exhausted remediation names the step and its outstanding questions', () => {
    const restatement = 'A claim the pipeline could not finish.';
    const id = claimIdFor(restatement);
    const dir = path.join(root, 'claims', id);
    write(dir, 'claim.md', `---\ncorpusSchemaVersion: 0.1.0\nclaimKind: claim\ncanonicalRestatement: |\n  ${restatement}\n---\n\nStopped.\n`);
    write(dir, 'runs/r1.json', JSON.stringify({
      claim: restatement,
      result: { kind: 'needs_clarification', step: 'grade:https://example.com/x', questions: ['which of two readings was meant?'] },
      provenance: { runId: 'r1', recordedAt: STAMP },
    }));

    const text = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document.body.textContent ?? '';
    expect(text).toContain('grade:https://example.com/x');
    expect(text).toContain('which of two readings was meant?');
  });
});

describe('stability record across runs (FR-029, FR-029a, SC-011)', () => {
  const restatement = 'A claim that has been run more than once.';
  let id: string;

  function setup(runs: { band: string; origins: string[]; at: string }[]): void {
    id = claimIdFor(restatement);
    const dir = path.join(root, 'claims', id);
    write(dir, 'claim.md', `---\ncorpusSchemaVersion: 0.1.0\nclaimKind: claim\ncanonicalRestatement: |\n  ${restatement}\n---\n\nProse.\n`);
    for (const run of runs) {
      // Colons are illegal in Windows filenames, so an ISO timestamp cannot be
      // used verbatim as one.
      const safe = run.at.replace(/[:.]/g, '-');
      write(dir, `runs/run-${safe}.json`, JSON.stringify(completedRun(restatement, run.band, run.origins, run.at)));
    }
  }

  it('lists every run with its date, engine version and band', () => {
    setup([
      { band: 'probable', origins: ['https://a.example/1'], at: '2026-01-01T00:00:00.000Z' },
      { band: 'established', origins: ['https://a.example/1', 'https://b.example/2'], at: '2026-02-01T00:00:00.000Z' },
    ]);
    const doc = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document;
    const rows = doc.querySelectorAll('table tbody tr');
    expect(rows.length).toBe(2);
    expect(doc.body.textContent).toContain('Stability across runs');
  });

  it('marks whether each run shared the displayed run\'s evidence base (FR-029b)', () => {
    setup([
      { band: 'probable', origins: ['https://a.example/1'], at: '2026-01-01T00:00:00.000Z' },
      { band: 'established', origins: ['https://a.example/1', 'https://b.example/2'], at: '2026-02-01T00:00:00.000Z' },
    ]);
    const text = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document.body.textContent ?? '';
    expect(text).toContain('same evidence');
    expect(text).toContain('different evidence');
  });

  it('surfaces disagreement between runs on the SAME evidence at the band (FR-029a)', () => {
    // Identical origins, different bands: the displayed band is unstable, and a
    // reader must see that without comparing table rows themselves.
    setup([
      { band: 'probable', origins: ['https://a.example/1'], at: '2026-01-01T00:00:00.000Z' },
      { band: 'established', origins: ['https://a.example/1'], at: '2026-02-01T00:00:00.000Z' },
    ]);
    const text = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document.body.textContent ?? '';
    expect(text).toMatch(/Runs on the same evidence disagreed/i);
    expect(text).toMatch(/unstable rather than settled/i);
  });

  it('shows no disagreement notice when runs on the same evidence agree', () => {
    setup([
      { band: 'established', origins: ['https://a.example/1'], at: '2026-01-01T00:00:00.000Z' },
      { band: 'established', origins: ['https://a.example/1'], at: '2026-02-01T00:00:00.000Z' },
    ]);
    const text = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document.body.textContent ?? '';
    expect(text).not.toMatch(/disagreed/i);
  });

  it('omits the stability section entirely for a single-run claim', () => {
    setup([{ band: 'established', origins: ['https://a.example/1'], at: '2026-01-01T00:00:00.000Z' }]);
    const text = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document.body.textContent ?? '';
    expect(text).not.toContain('Stability across runs');
  });

  it('displays the newest run as the current verdict', () => {
    setup([
      { band: 'probable', origins: ['https://a.example/1'], at: '2026-01-01T00:00:00.000Z' },
      { band: 'established', origins: ['https://a.example/1'], at: '2026-02-01T00:00:00.000Z' },
    ]);
    const doc = new JSDOM(renderClaimPage(readClaim(root, id), { generatedAt: STAMP })).window.document;
    expect(doc.querySelector('.verdict-band')?.textContent).toBe('Established');
  });
});
