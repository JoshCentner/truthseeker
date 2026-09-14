import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retrieveAll, verifySnapshot } from '../retrieve.js';
import type { CandidateOrigin } from '../types.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

let scratchDir: string;

beforeEach(() => {
  scratchDir = mkdtempSync(path.join(tmpdir(), 'pipeline-test-'));
  process.env.PIPELINE_RUNS_DIR = scratchDir;
});

afterEach(() => {
  delete process.env.PIPELINE_RUNS_DIR;
  rmSync(scratchDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

function candidate(url: string): CandidateOrigin {
  return { url, title: '', foundVia: 'test' };
}

describe('retrieve (FR-012-014, FR-036)', () => {
  it('archives a real content hash for a successful fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response('hello world', { status: 200, headers: { 'content-type': 'text/html' } }),
      ),
    );
    const [origin] = await retrieveAll([candidate('https://real.example.com/article')]);
    expect(origin!.content).toBe('hello world');
    expect(origin!.fetch.succeeded).toBe(true);
    expect(origin!.fetch.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(verifySnapshot(origin!.fetch, 'hello world')).toBe(true);
    expect(verifySnapshot(origin!.fetch, 'tampered content')).toBe(false);
  });

  it('archives a record even when the fetch fails outright (FR-013)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('getaddrinfo ENOTFOUND');
      }),
    );
    const [origin] = await retrieveAll([candidate('https://does-not-resolve.invalid/x')]);
    expect(origin!.fetch.succeeded).toBe(false);
    expect(origin!.content).toBeNull();
    expect(origin!.fetch.fetchedAt.length).toBeGreaterThan(0); // still recorded
  });

  it('archives a record for a non-2xx response and treats it as could_not_retrieve', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    const [origin] = await retrieveAll([candidate('https://real.example.com/missing')]);
    expect(origin!.fetch.succeeded).toBe(false);
    expect(origin!.fetch.httpStatus).toBe(404);
    expect(origin!.content).toBeNull();
  });

  it('treats a paywall snippet response as could_not_retrieve (accepted FR-014 clarification)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Subscribe to continue reading this article.', { status: 200 })),
    );
    const [origin] = await retrieveAll([candidate('https://paywalled.example.com/x')]);
    expect(origin!.content).toBeNull();
    expect(origin!.fetch.succeeded).toBe(true); // the HTTP request itself succeeded — only content is withheld
  });

  it("uses the candidate's own URL as the origin id, since 001's schema carries no separate URL field (FR-007 of 004)", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('content', { status: 200 })));
    const [origin] = await retrieveAll([candidate('https://real.example.com/article')]);
    expect(origin!.id).toBe('https://real.example.com/article');
  });

  it('deduplicates ids with a numeric suffix only when two candidates share the exact same URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('content', { status: 200 })));
    const [first, second] = await retrieveAll([candidate('https://real.example.com/dup'), candidate('https://real.example.com/dup')]);
    expect(first!.id).toBe('https://real.example.com/dup');
    expect(second!.id).toBe('https://real.example.com/dup#1');
  });
});
