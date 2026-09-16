import fs from 'node:fs';
import path from 'node:path';
import { parseClaimRecord, type ClaimRecord } from './claim-record.js';
import { claimIdFor } from './identity.js';
import { parseRunRecord, type StoredRun } from './run-records.js';

/** Reading a claim directory, and refusing every shape the corpus must not take. */

export interface SupplementaryFile {
  filename: string;
  body: string;
}

export interface Claim {
  id: string;
  dir: string;
  record: ClaimRecord;
  supplementary: SupplementaryFile[];
  runs: StoredRun[];
}

export class CorpusError extends Error {}

export const CLAIM_FILE = 'claim.md';
export const RUNS_DIR = 'runs';

function claimsRoot(corpusDir: string): string {
  return path.join(corpusDir, 'claims');
}

/** Directory entries sorted by name — never filesystem order, which is not
 * guaranteed to be stable across platforms and would break determinism
 * (research.md §8). */
function sortedEntries(dir: string): fs.Dirent[] {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

export function listClaimIds(corpusDir: string): string[] {
  const root = claimsRoot(corpusDir);
  if (!fs.existsSync(root)) return [];
  return sortedEntries(root)
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

export function readClaim(corpusDir: string, id: string): Claim {
  const dir = path.join(claimsRoot(corpusDir), id);
  if (!fs.existsSync(dir)) {
    throw new CorpusError(`claim "${id}" not found under ${claimsRoot(corpusDir)}`);
  }

  const claimFile = path.join(dir, CLAIM_FILE);
  if (!fs.existsSync(claimFile)) {
    throw new CorpusError(`claim "${id}" has no ${CLAIM_FILE}`);
  }
  const record = parseClaimRecord(fs.readFileSync(claimFile, 'utf-8'), path.join(id, CLAIM_FILE));

  // FR-002: relationships are declared in frontmatter, never by nesting. A claim
  // directory inside another claim directory is the filesystem trying to encode
  // the graph, which is exactly what the flat layout exists to prevent.
  for (const entry of sortedEntries(dir)) {
    if (entry.isDirectory() && entry.name !== RUNS_DIR) {
      throw new CorpusError(
        `claim "${id}" contains a nested directory "${entry.name}". Claims and sub-claims are siblings; ` +
          `a relationship is declared in the sub-claim's own frontmatter, never by nesting (FR-002).`,
      );
    }
  }

  // FR-008 / FR-007a: the directory name must be the id its restatement derives.
  // Because the id is a pure function of the restatement, this one comparison
  // enforces immutability — editing the restatement changes the derived id and
  // the claim no longer matches the directory it sits in.
  if (record.claimKind === 'claim') {
    const expected = claimIdFor(record.canonicalRestatement as string);
    if (expected !== id) {
      throw new CorpusError(
        `claim "${id}" does not match its canonical restatement, which derives "${expected}".\n` +
          `  A restatement is frozen once the claim holds a run (FR-007a): evidence must not migrate to a\n` +
          `  differently-worded proposition. A reworded claim is a NEW claim directory whose frontmatter\n` +
          `  names this one in "supersedes".`,
      );
    }
  }

  const supplementary: SupplementaryFile[] = [];
  for (const entry of sortedEntries(dir)) {
    if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === CLAIM_FILE) continue;
    const contents = fs.readFileSync(path.join(dir, entry.name), 'utf-8');
    supplementary.push({ filename: entry.name, body: contents.replace(/\r\n/g, '\n').trim() });
  }

  const runs: StoredRun[] = [];
  const runsDir = path.join(dir, RUNS_DIR);
  if (fs.existsSync(runsDir)) {
    for (const entry of sortedEntries(runsDir)) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const file = path.join(id, RUNS_DIR, entry.name);
      let json: unknown;
      try {
        json = JSON.parse(fs.readFileSync(path.join(runsDir, entry.name), 'utf-8'));
      } catch (err) {
        throw new CorpusError(`${file}: not valid JSON — ${err instanceof Error ? err.message : String(err)}`);
      }
      runs.push(parseRunRecord(json, file));
    }
  }

  // FR-007d: a run's stored claim text must match the claim's restatement. Under
  // FR-007a this should be unreachable; it is checked anyway because a mismatch
  // means the corpus was edited in a way that breaks the evidence linkage, and
  // that must fail loudly rather than render.
  if (record.claimKind === 'claim') {
    for (const run of runs) {
      if (run.claimText !== undefined && run.claimText !== record.canonicalRestatement) {
        throw new CorpusError(
          `${run.file}: the run was executed against a different claim text than this claim's restatement.\n` +
            `  run:   ${JSON.stringify(run.claimText)}\n` +
            `  claim: ${JSON.stringify(record.canonicalRestatement)}`,
        );
      }
    }
  }

  // Newest first, with the filename as a stable tiebreak so equal timestamps
  // never reorder between runs (research.md §8).
  runs.sort((a, b) => (b.recordedAt.localeCompare(a.recordedAt) || a.file.localeCompare(b.file)));

  return { id, dir, record, supplementary, runs };
}

export function readAllClaims(corpusDir: string): Claim[] {
  return listClaimIds(corpusDir).map((id) => readClaim(corpusDir, id));
}
