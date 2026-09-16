import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runOrchestration } from '../../src-pipeline/index.js';
import { evaluate } from '../../src/index.js';
import { ManualLlmClient, NeedsHumanResponse, type TranscriptEntry } from './manual-client.mjs';
import { claimIdFor } from '../../src-corpus/identity.js';

const ROOT = process.cwd();

/**
 * Caches every fetch to disk, keyed by URL. The first fetch is a real one and
 * its real status/bytes are what gets archived; re-runs (this runner is
 * replay-driven, so a claim is run several times as its transcript fills in)
 * reuse the identical bytes so content hashes stay stable across replays.
 * Deliberately adds no headers — retrieve.ts's plain fetch() is what a real
 * run uses, and a bot-blocked source SHOULD come back could_not_retrieve
 * (quickstart.md's accepted FR-014 behaviour).
 */
function installFetchCache(cacheDir: string): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  const realFetch = globalThis.fetch;
  const NULL_BODY = new Set([204, 205, 304]);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : String(input);
    const key = createHash('sha256').update(url).digest('hex').slice(0, 32);
    const metaPath = path.join(cacheDir, `${key}.json`);
    const bodyPath = path.join(cacheDir, `${key}.body`);
    const build = (body: string, status: number, finalUrl: string): Response => {
      const res = new Response(NULL_BODY.has(status) ? null : body, { status });
      Object.defineProperty(res, 'url', { value: finalUrl });
      return res;
    };
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return build(fs.readFileSync(bodyPath, 'utf-8'), meta.status, meta.finalUrl);
    }
    const res = await realFetch(input as RequestInfo, init);
    const body = await res.text();
    fs.writeFileSync(metaPath, JSON.stringify({ url, status: res.status, finalUrl: res.url, fetchedAt: new Date().toISOString() }, null, 2));
    fs.writeFileSync(bodyPath, body, 'utf-8');
    return build(body, res.status, res.url);
  }) as typeof fetch;
}

/** Turns a prompt carrying raw fetched HTML into something a person can read. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

const OPEN_TAG = /<untrusted-web-content source-id="([^"]*)">/;
const CLOSE_TAG = '</untrusted-web-content>';

function renderPromptForHuman(prompt: string, budget = 12000): string {
  const open = prompt.match(OPEN_TAG);
  if (!open || open.index === undefined) {
    return prompt.length > budget * 2 ? `${prompt.slice(0, budget * 2)}\n\n[...truncated...]` : prompt;
  }
  const bodyStart = open.index + open[0].length;
  const bodyEnd = prompt.indexOf(CLOSE_TAG, bodyStart);
  const head = prompt.slice(0, bodyStart);
  const tail = prompt.slice(bodyEnd);
  const body = htmlToText(prompt.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd));
  const shown = body.length > budget ? `${body.slice(0, budget)}\n\n[...${body.length - budget} more characters of page text omitted...]` : body;
  return `${head}\n${shown}\n${tail}`;
}

function slugify(claim: string): string {
  return claim.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const claim = args.find((a) => !a.startsWith('--'));
  const slugIdx = args.indexOf('--slug');
  const requesterIdx = args.indexOf('--requester');
  if (!claim) {
    console.error('Usage: run.mts "<claim>" [--slug <name>] [--requester <name>]');
    process.exit(4);
  }
  const slug = slugIdx !== -1 ? args[slugIdx + 1] : slugify(claim);
  const requester = requesterIdx !== -1 ? args[requesterIdx + 1] : 'manual-run';

  const dir = path.join(ROOT, 'tools', 'manual-run', 'transcripts', slug);
  const transcriptPath = path.join(dir, 'transcript.json');
  const pendingDir = path.join(dir, 'pending');
  fs.mkdirSync(dir, { recursive: true });
  fs.rmSync(pendingDir, { recursive: true, force: true });

  const entries: TranscriptEntry[] = fs.existsSync(transcriptPath)
    ? JSON.parse(fs.readFileSync(transcriptPath, 'utf-8'))
    : [];

  installFetchCache(path.join(dir, 'fetch-cache'));
  const llm = new ManualLlmClient(entries);

  try {
    const result = await runOrchestration(claim, llm, {
      requester,
      onProgress: (step) => console.error(`  [step] ${step}`),
    });

    console.log('=== PipelineResult ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.kind === 'completed') {
      const verdict = evaluate(result.ledger);
      console.log('=== evaluate(result.ledger) ===');
      console.log(JSON.stringify(verdict, null, 2));

      const record = {
        claim,
        slug,
        result,
        verdict,
        provenance: {
          producedBy: 'tools/manual-run',
          llm: 'claude-opus-5, answering each step prompt in an interactive session',
          reason: 'Gemini Search grounding has no free-tier quota for accounts post-dating the 2.5 cutoff, blocking the automated path.',
          blindnessCaveat:
            'Principle II blindness is a discipline here, not an architectural guarantee: a single context answered every step. NOT a protocol-clean run.',
          recordedAt: new Date().toISOString(),
        },
      };
      // 005 restructured the corpus into one directory per claim, with the
      // claim's identity derived from its canonical restatement. Writing to the
      // old flat corpus/runs/ would put the record somewhere nothing reads.
      const claimId = claimIdFor(claim);
      const outDir = path.join(ROOT, 'corpus', 'claims', claimId, 'runs');
      fs.mkdirSync(outDir, { recursive: true });
      const outPath = path.join(outDir, `${result.trace.runId}.json`);
      fs.writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
      console.error(`\n[record] ${path.relative(ROOT, outPath)}`);
      console.error(`[band]   ${verdict.band}${verdict.qualifier ? ` (${verdict.qualifier})` : ''} via ${verdict.tree}`);
    }
    process.exit(0);
  } catch (err) {
    if (!(err instanceof NeedsHumanResponse)) throw err;

    fs.mkdirSync(pendingDir, { recursive: true });
    console.error(`\n=== ${llm.pending.length} prompt(s) need answers ===`);
    for (const p of llm.pending) {
      const stem = path.join(pendingDir, `${String(p.index).padStart(2, '0')}-${p.kind}-${p.hash}`);
      fs.writeFileSync(`${stem}.full.txt`, p.prompt, 'utf-8');
      fs.writeFileSync(`${stem}.view.txt`, renderPromptForHuman(p.prompt), 'utf-8');
      console.error(`  ${path.relative(ROOT, `${stem}.view.txt`)}  (${p.prompt.length} chars raw)`);
    }
    console.error(`\nMatched so far: ${llm.matched.map((m) => m.note).join(' -> ') || '(none)'}`);
    console.error(`Add entries to ${path.relative(ROOT, transcriptPath)} and re-run.`);
    process.exit(7);
  }
}

await main();
