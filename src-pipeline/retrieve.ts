import { createHash } from 'node:crypto';
import type { CandidateOrigin, FetchRecord, RetrievedOrigin } from './types.js';
import { appendJsonLine, FETCH_ARCHIVE_FILE } from './storage.js';
import { classifyDomain } from './registry.js';

const SUBSCRIPTION_MARKERS = [
  'subscribe to continue reading',
  'this content is for subscribers',
  'sign in to read the full article',
  'create a free account to continue',
];

/**
 * Markers for the other family of walls: consent gates, script requirements and
 * bot checks. Added 2026-09-15 after a live run fetched
 * https://pubmed.ncbi.nlm.nih.gov/30831578/ and got HTTP 203 carrying only
 * "Cookies must be enabled ... reload this page to continue". Because the
 * status was inside the 2xx range and the body contained no subscription
 * wording, the origin was recorded as `retrieved` and the cookie notice was
 * handed to the grading step as if it were the study.
 */
const ACCESS_WALL_MARKERS = [
  'cookies must be enabled',
  'enable cookies',
  'please enable javascript',
  'javascript is required',
  'javascript is disabled',
  'verify you are human',
  'checking your browser',
  'enable js and disable any ad blocker',
  'unusual traffic from your computer',
  'request could not be satisfied',
];

/**
 * Visible text length, not raw byte length. The cookie wall above was 5,565
 * bytes of markup carrying roughly a hundred characters a reader would ever
 * see, so a threshold over the raw body could not distinguish it from a short
 * article. Stripping to visible text is what makes the two separable.
 */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Accepted FR-014 clarification: a snippet-only wall is treated as
 * could_not_retrieve, not a distinct partial state. This heuristic is
 * intentionally conservative — a short response consisting of nothing but
 * subscription or access-gate language is exactly the "characterization of the
 * source, not the source itself" shape FR-014's rationale describes, and
 * erring toward could_not_retrieve is the safe direction: the origin then
 * grades as a zero-weight bare assertion instead of lending a wall the warrant
 * of the document behind it.
 */
function looksLikeWall(content: string): boolean {
  const text = visibleText(content);
  const lower = text.toLowerCase();
  if (SUBSCRIPTION_MARKERS.some((marker) => lower.includes(marker)) && text.length < 500) {
    return true;
  }
  return ACCESS_WALL_MARKERS.some((marker) => lower.includes(marker)) && text.length < 1500;
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
    if (looksLikeWall(body)) {
      // fetch.succeeded stays true: it records whether the HTTP request
      // succeeded, which it did. Withholding the content is what flips the
      // ledger's retrievalStatus to could_not_retrieve, which is the field
      // that carries 'we do not have this source'.
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
