import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MockLlmClient } from '../llm-client.js';
import { runHarmGate } from '../harm-gate.js';

const PIPELINE_DIR = path.join(process.cwd(), 'src-pipeline');
const MODULES_ALLOWED_TO_MENTION_APIKEY = new Set(['index.ts', 'llm-client.ts', 'cli.ts']);

describe('key non-persistence (FR-008, FR-009)', () => {
  it('static: no module besides index.ts/llm-client.ts/cli.ts ever references apiKey', () => {
    const files = readdirSync(PIPELINE_DIR).filter((f) => f.endsWith('.ts'));
    const offenders: string[] = [];
    for (const file of files) {
      if (MODULES_ALLOWED_TO_MENTION_APIKEY.has(file)) continue;
      const content = readFileSync(path.join(PIPELINE_DIR, file), 'utf-8');
      if (/apiKey/.test(content)) offenders.push(file);
    }
    expect(offenders, `these modules unexpectedly reference apiKey: ${offenders.join(', ')}`).toEqual([]);
  });

  it('runtime: a run that writes to the review queue never contains a key-shaped string, because the orchestration never received one', async () => {
    const scratchDir = mkdtempSync(path.join(tmpdir(), 'pipeline-test-'));
    process.env.PIPELINE_RUNS_DIR = scratchDir;
    try {
      const llm = new MockLlmClient([
        { generate: { text: JSON.stringify({ outcome: 'needs_review', reason: 'borderline case' }) } },
      ]);
      // runHarmGate's signature (claim, llm, runId) has no apiKey parameter at
      // all — there is nothing to leak by construction, which is the actual
      // guarantee FR-008/FR-009 need, not just an absence in this one run.
      await runHarmGate('some claim', llm, 'run-key-test');
      const written = readFileSync(path.join(scratchDir, 'review-queue.jsonl'), 'utf-8');
      expect(written).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/); // shape of a real Google API key
    } finally {
      delete process.env.PIPELINE_RUNS_DIR;
      rmSync(scratchDir, { recursive: true, force: true });
    }
  });
});
