import { createHash } from 'node:crypto';
import type { CandidateOrigin, FetchRecord, RetrievedOrigin } from './types.js';
import { appendJsonLine, FETCH_ARCHIVE_FILE } from './storage.js';
import { classifyDomain } from './registry.js';

const PAYWALL_SNIPPET_MARKERS = [
  'subscribe to continue reading',
  'this content is for subscribers',
  'sign in to read the full article',
  'create a free account to continue',
];

/** Accepted FR-014 clarification: a snippet-only paywall response is treated
 * as could_not_retrieve, not a distinct partial state. This heuristic is
 * intentionally conservative — a short response containing subscription
 * language is exactly the "characterization of the source, not the source
 * itself" shape FR-014's rationale describes. */
function looksLikePaywallSnippet(content: string): boolean {
  const lower = content.toLowerCase();
  return PAYWALL_SNIPPET_MARKERS.some((marker) => lower.includes(marker)) && content.length < 500;
}

async function fetchOne(candidate: CandidateOrigin): Promise<{ fetch: FetchRecord; content: string | null }> {
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(candidate.url, { redirect: 'follow' });
    const body = await response.text();
    const contentHash = createHash('sha256').update(body).digest('hex');
    const record: FetchRecord = {
      requestedUrl: candidate.url,
      finalUrl: response.url,
      succeeded: response.ok,
      httpStatus: response.status,
      contentHash,
      fetchedAt,
    };
    if (!response.ok) {
      return { fetch: record, content: null };
    }
    if (looksLikePaywallSnippet(body)) {
      return { fetch: record, content: null };
    }
    return { fetch: record, content: body };
  } catch {
    // Network failure, DNS failure, etc. — still archived (FR-013), just with nulls where there's nothing to record.
    return {
      fetch: {
        requestedUrl: candidate.url,
        finalUrl: null,
        succeeded: false,
        httpStatus: null,
        contentHash: null,
        fetchedAt,
      },
      content: null,
    };
  }
}

/**
 * FR-012-014: retrieves the real bytes of every candidate, independent of
 * the search step's own grounding metadata (research.md §3). FR-013: every
 * attempt is archived, success or failure.
 *
 * Origin ids are the candidate's own URL, not an arbitrary counter — 001's
 * Origin.id is an opaque string as far as the engine is concerned, but this
 * feature's own downstream consumers (004's dashboard, FR-007's "every
 * origin's URL") need the id to actually BE the URL, since 001's schema
 * carries no separate URL field. A numeric suffix is appended only on an
 * actual collision (the rare case where two candidates resolve to the exact
 * same URL), so ids stay both unique and, in the overwhelmingly common case,
 * exactly the human-readable URL.
 */
export async function retrieveAll(candidates: CandidateOrigin[]): Promise<RetrievedOrigin[]> {
  const results: RetrievedOrigin[] = [];
  const seenUrls = new Map<string, number>();
  for (const candidate of candidates) {
    const { fetch: fetchRecord, content } = await fetchOne(candidate);
    await appendJsonLine(FETCH_ARCHIVE_FILE, fetchRecord);
    const seenCount = seenUrls.get(candidate.url) ?? 0;
    seenUrls.set(candidate.url, seenCount + 1);
    const id = seenCount === 0 ? candidate.url : `${candidate.url}#${seenCount}`;
    results.push({
      id,
      candidate,
      fetch: fetchRecord,
      content,
      registryClass: classifyDomain(candidate.url), // FR-037
    });
  }
  return results;
}

/** FR-036: deterministic re-validation from an archived snapshot, no live re-fetch. */
export function verifySnapshot(record: FetchRecord, content: string): boolean {
  if (!record.contentHash) return false;
  return createHash('sha256').update(content).digest('hex') === record.contentHash;
}
