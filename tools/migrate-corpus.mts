import fs from 'node:fs';
import path from 'node:path';
import { claimIdFor } from '../src-corpus/identity.js';
import { CORPUS_SCHEMA_VERSION } from '../src-corpus/claim-record.js';

/**
 * Moves the flat `corpus/runs/*.json` records into the claim-folder layout that
 * 005 introduces, generating each claim's authored `claim.md` from the
 * restatement the run itself was executed against.
 *
 * Deriving the restatement from the record rather than asking for it is what
 * keeps FR-007d satisfiable: the claim text on disk is, by construction, the
 * text the evidence was gathered for.
 *
 * Idempotent — a claim directory that already exists is left alone.
 */

const ROOT = process.cwd();
const OLD_RUNS = path.join(ROOT, 'corpus', 'runs');
const CLAIMS = path.join(ROOT, 'corpus', 'claims');

function claimMarkdown(restatement: string, note: string): string {
  return [
    '---',
    `corpusSchemaVersion: ${CORPUS_SCHEMA_VERSION}`,
    'claimKind: claim',
    'canonicalRestatement: |',
    ...restatement.split('\n').map((l) => `  ${l}`),
    '---',
    '',
    '## About this claim',
    '',
    note,
    '',
    '## How this record was produced',
    '',
    'See the provenance block on the generated report. Records produced through `tools/manual-run/`',
    'were answered step by step by a human-driven session rather than by an unattended pipeline run,',
    'so the blind-grading guarantee of Constitution Principle II held as a discipline rather than as',
    'an architectural property. The report states this; do not read such a record as protocol-clean.',
    '',
  ].join('\n');
}

const NOTES: Record<string, string> = {
  'great-wall': [
    'A long-lived popular belief with abundant published evidence on both sides, which makes it a',
    'useful first test of whether the pipeline\'s sourcing and grading behave sensibly. Worth noting',
    'when reading the ledger: the strongest counter-evidence is an optics calculation rather than a',
    'direct observation.',
  ].join('\n'),
  'vaccines-autism': [
    'Recorded as a causal claim. The pipeline does not yet evaluate causal claims on their evidence —',
    'Tree 2 returns a fixed conservative band before any evidence is consulted — so this record exists',
    'to exercise that path honestly rather than to settle anything. Read the outcome as "this system',
    'does not yet judge causal claims", not as a finding about the claim.',
  ].join('\n'),
};

function main(): void {
  if (!fs.existsSync(OLD_RUNS)) {
    console.log('No corpus/runs/ directory — nothing to migrate.');
    return;
  }

  const files = fs.readdirSync(OLD_RUNS).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) {
    console.log('corpus/runs/ holds no records — nothing to migrate.');
    return;
  }

  fs.mkdirSync(CLAIMS, { recursive: true });
  let moved = 0;

  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(path.join(OLD_RUNS, file), 'utf-8'));
    const restatement: string | undefined = record?.result?.ledger?.claimRestatement ?? record?.claim;
    if (!restatement) {
      console.error(`SKIP ${file}: no claim restatement found in the record`);
      continue;
    }

    const id = claimIdFor(restatement);
    const dir = path.join(CLAIMS, id);
    const runsDir = path.join(dir, 'runs');
    fs.mkdirSync(runsDir, { recursive: true });

    const claimFile = path.join(dir, 'claim.md');
    if (!fs.existsSync(claimFile)) {
      const slug: string = record?.slug ?? '';
      fs.writeFileSync(claimFile, claimMarkdown(restatement, NOTES[slug] ?? 'Recorded during live validation of the pipeline.'), 'utf-8');
    }

    const runId: string = record?.result?.trace?.runId ?? path.basename(file, '.json');
    fs.writeFileSync(path.join(runsDir, `${runId}.json`), `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
    fs.rmSync(path.join(OLD_RUNS, file));
    moved++;
    console.log(`moved ${file}\n   -> corpus/claims/${id}/runs/${runId}.json`);
  }

  if (fs.readdirSync(OLD_RUNS).length === 0) {
    fs.rmdirSync(OLD_RUNS);
    console.log('removed the now-empty corpus/runs/');
  }
  console.log(`\nMigrated ${moved} record(s).`);
}

main();
