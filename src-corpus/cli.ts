#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readAllClaims, readClaim, listClaimIds, CorpusError } from './corpus.js';
import { buildGraph, GraphError } from './graph.js';
import { renderClaimPage } from './render-claim.js';
import { ClaimRecordError } from './claim-record.js';
import { FrontmatterError } from './frontmatter.js';
import { RunRecordError } from './run-records.js';
import { UnknownTermError } from './vocabulary.js';

/**
 * The report generator (contracts/generator-cli.md).
 *
 * Reads no key and makes no network request. Whole-corpus validation always
 * runs even when rendering a single claim, because identity, reference and
 * cycle checks are cross-claim by nature — rendering one page from a corpus
 * that does not hold together would publish something the corpus cannot vouch
 * for.
 */

const EXIT = { ok: 0, notFound: 1, invalid: 2, noRuns: 3, usage: 4 } as const;

function usage(): void {
  console.error('Usage: node --import tsx src-corpus/cli.ts <claim-id> [--out <dir>] [--corpus <dir>] [--check]');
  console.error('       --out      output directory (default: dist-site)');
  console.error('       --corpus   corpus root (default: corpus)');
  console.error('       --check    validate only; write nothing');
}

function flag(args: string[], name: string, fallback: string): string {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const value = args[i + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${name} needs a value`);
    process.exit(EXIT.usage);
  }
  return value;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(EXIT.ok);
  }

  const claimId = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out' && args[args.indexOf(a) - 1] !== '--corpus');
  const outDir = flag(args, '--out', 'dist-site');
  const corpusDir = flag(args, '--corpus', 'corpus');
  const checkOnly = args.includes('--check');

  if (!claimId) {
    usage();
    process.exit(EXIT.usage);
  }

  const known = listClaimIds(corpusDir);
  if (!known.includes(claimId)) {
    console.error(`Claim "${claimId}" is not in ${corpusDir}/claims/.`);
    if (known.length > 0) {
      console.error('\nClaims in this corpus:');
      for (const id of known) console.error(`  ${id}`);
    }
    process.exit(EXIT.notFound);
  }

  // Whole-corpus validation first: identity, references, acyclicity.
  const claims = readAllClaims(corpusDir);
  const graph = buildGraph(claims);

  const claim = readClaim(corpusDir, claimId);
  if (claim.runs.length === 0) {
    console.error(`Claim "${claimId}" holds no run record, so there is no report to generate.`);
    process.exit(EXIT.noRuns);
  }

  const html = renderClaimPage(claim, {
    children: graph.childrenOf.get(claim.id) ?? [],
    supersededBy: graph.supersededBy.get(claim.id),
  });

  if (checkOnly) {
    console.log(`OK: ${claimId} validates and renders (${html.length} bytes, not written).`);
    process.exit(EXIT.ok);
  }

  const target = path.join(outDir, 'claims', `${claimId}.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf-8');
  console.log(`Wrote ${target}`);
  process.exit(EXIT.ok);
}

try {
  main();
} catch (err) {
  // Every corpus failure is read by a contributor who cannot see this code, so
  // the message names the file and the specific problem rather than a stack.
  if (
    err instanceof CorpusError ||
    err instanceof GraphError ||
    err instanceof ClaimRecordError ||
    err instanceof FrontmatterError ||
    err instanceof RunRecordError ||
    err instanceof UnknownTermError
  ) {
    console.error(`\n${err.message}\n`);
    process.exit(EXIT.invalid);
  }
  throw err;
}
