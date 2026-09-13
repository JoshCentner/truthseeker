import type { LlmClient } from './llm-client.js';
import type { CandidateOrigin } from './types.js';

/** Implementation-level parameters, not spec-level ambiguities (tasks.md T024's own note) —
 * the *shape* of the stopping condition is the accepted FR-011 clarification; these exact
 * numbers are ordinary tuning constants. */
const MAX_EMPTY_ATTEMPTS = 3;
const TARGET_INDEPENDENT_DOMAINS = 2; // the protocol's own Established-tier corroboration threshold

function distinctDomains(candidates: CandidateOrigin[]): Set<string> {
  const domains = new Set<string>();
  for (const c of candidates) {
    try {
      domains.add(new URL(c.url).hostname);
    } catch {
      // Malformed URL — still kept in the candidate list, just not counted toward independence.
    }
  }
  return domains;
}

function buildSearchPrompt(claim: string, alreadyFoundUrls: string[]): string {
  const alreadyFoundNote =
    alreadyFoundUrls.length > 0
      ? `Sources already found: ${alreadyFoundUrls.join(', ')}. Look for additional, independent sources not already in this list.`
      : '';
  return `Search the web for sources relevant to evaluating this claim: ${JSON.stringify(claim)}\n\n${alreadyFoundNote}`;
}

/**
 * FR-011: stop once either (a) 2+ distinct-domain candidates have been found
 * (a proxy for independent clusters ahead of 001's real clustering), or
 * (b) a fixed number of consecutive attempts turn up nothing new — whichever
 * comes first. FR-015/FR-016: zero candidates is a valid, honest outcome,
 * never fabricated.
 */
export async function discoverCandidates(claim: string, llm: LlmClient): Promise<CandidateOrigin[]> {
  const candidates: CandidateOrigin[] = [];
  let emptyAttempts = 0;

  while (emptyAttempts < MAX_EMPTY_ATTEMPTS) {
    const alreadyFound = candidates.map((c) => c.url);
    const prompt = buildSearchPrompt(claim, alreadyFound);
    const response = await llm.generateWithSearch(prompt);

    const newUrls = response.groundingUrls.filter((url) => !candidates.some((c) => c.url === url));
    if (newUrls.length === 0) {
      emptyAttempts++;
      continue;
    }
    emptyAttempts = 0;
    for (const url of newUrls) {
      candidates.push({ url, title: '', foundVia: prompt.slice(0, 120) });
    }

    if (distinctDomains(candidates).size >= TARGET_INDEPENDENT_DOMAINS) {
      break;
    }
  }

  return candidates;
}
