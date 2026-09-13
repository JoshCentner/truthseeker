import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** Read lazily (not cached at module load) so tests can override it per-test
 * via PIPELINE_RUNS_DIR without needing to reset module state. */
function runsDirPath(): string {
  return process.env.PIPELINE_RUNS_DIR ?? path.join(process.cwd(), 'runs');
}

/**
 * Appends one JSON-encoded record as a line to a file under runs/ (research.md
 * §4). Creates the directory if needed. Never overwrites — this is an
 * append-only log, matching a review queue's and a fetch archive's actual
 * shape (many independent records, never edited in place).
 */
export async function appendJsonLine(filename: string, record: unknown): Promise<void> {
  const dir = runsDirPath();
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify(record) + '\n';
  await appendFile(path.join(dir, filename), line, 'utf-8');
}

export const REVIEW_QUEUE_FILE = 'review-queue.jsonl';
export const FETCH_ARCHIVE_FILE = 'fetch-archive.jsonl';

/** Exposed for tests that need to point at a scratch directory instead of the real runs/. */
export function runsDir(): string {
  return runsDirPath();
}
