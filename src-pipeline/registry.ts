import type { RegistryEntry, RegistryClass } from './types.js';

/**
 * FR-037, FR-039: a small, seed, curated list — not a comprehensive or
 * actively-maintained system (spec.md Assumptions). Extending this list is
 * reasonable future follow-up work, not a blocker to functioning correctly
 * on the domains it does know about.
 *
 * METHODOLOGY NOTE. The constitution treats registry changes as methodology
 * changes requiring separate review, and warns that they are reputation-
 * affecting. The distinction that keeps this list on the safe side of that
 * warning: these are STRUCTURAL classes — definitional statements about what
 * kind of document a domain publishes — not evidential reliability grades.
 * Saying Wikipedia is a tertiary reference work that contains no original
 * research is a description of its own stated editorial policy, and says
 * nothing about whether it is accurate. Poor and Fabricator, the grades that
 * ARE claims about an organisation, live on warrants and are contestable
 * through the normal challenge mechanism, not here.
 */
export const SEED_REGISTRY: RegistryEntry[] = [
  // News aggregators: republish or syndicate other outlets' reporting.
  { domain: 'news.google.com', class: 'aggregator', note: 'Aggregates headlines from other outlets; never itself the original reporting.' },
  { domain: 'apple.news', class: 'aggregator', note: 'Aggregates articles from other publishers.' },
  { domain: 'flipboard.com', class: 'aggregator', note: 'User-curated aggregation of other outlets’ content.' },
  { domain: 'msn.com', class: 'aggregator', note: 'Syndicates and re-publishes wire and partner content, not original reporting.' },
  { domain: 'yahoo.com', class: 'aggregator', note: 'Syndicates wire and partner content alongside a news portal; rarely the original reporting.' },

  // Tertiary reference works: summarise and cite other sources by design. Added
  // 2026-09-17. Structurally identical to a news aggregator for our purposes —
  // each is a pointer to evidence held elsewhere, never the evidence itself —
  // so each takes the same class rather than a fifth class being invented. The
  // constitution names four registry classes; this list does not add to them.
  {
    domain: 'wikipedia.org',
    class: 'aggregator',
    note: 'Tertiary reference work. Its own core editorial policy forbids original research and requires every claim to be attributed to a published source, so it is by definition a summary of evidence held elsewhere and never the evidence itself. Covers every language and mobile subdomain.',
  },
  { domain: 'wikiwand.com', class: 'aggregator', note: 'Re-presents Wikipedia article content under a different interface; the same tertiary material.' },
  { domain: 'simple.wikipedia.org', class: 'aggregator', note: 'Simplified-English Wikipedia; tertiary reference work.' },
  { domain: 'britannica.com', class: 'aggregator', note: 'Encyclopedia. A tertiary reference work summarising scholarship held elsewhere.' },
  { domain: 'encyclopedia.com', class: 'aggregator', note: 'Aggregates encyclopedia and reference entries from other publishers.' },
  { domain: 'fandom.com', class: 'aggregator', note: 'Open user-edited wiki farm; tertiary and unattributed by construction.' },
  { domain: 'scholar.google.com', class: 'aggregator', note: 'A search index over other publishers’ papers, not a publisher of them. Cite the indexed paper.' },
  { domain: 'researchgate.net', class: 'aggregator', note: 'Hosts copies of papers published elsewhere; cite the publisher of record.' },

  { domain: 'prnewswire.com', class: 'press_release', note: 'Distributes press releases verbatim on behalf of the issuing organization.' },
  { domain: 'businesswire.com', class: 'press_release', note: 'Distributes press releases verbatim on behalf of the issuing organization.' },
  { domain: 'globenewswire.com', class: 'press_release', note: 'Distributes press releases verbatim on behalf of the issuing organization.' },
  { domain: 'arxiv.org', class: 'preprint', note: 'Preprint server — not yet peer reviewed.' },
  { domain: 'biorxiv.org', class: 'preprint', note: 'Preprint server — not yet peer reviewed.' },
  { domain: 'ssrn.com', class: 'preprint', note: 'Preprint/working-paper server — not yet peer reviewed.' },
  { domain: 'wsj.com', class: 'paywalled', note: 'Full content requires a subscription.' },
  { domain: 'ft.com', class: 'paywalled', note: 'Full content requires a subscription.' },
  { domain: 'nytimes.com', class: 'paywalled', note: 'Full content requires a subscription beyond a limited free allowance.' },
];

/** Matches the domain itself or any subdomain of it (e.g. "static.arxiv.org" matches "arxiv.org"). */
function matches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/** The full registry entry for a URL's domain, or null. Exposed so a caller can
 * quote the curated note rather than re-describing the domain itself. */
export function registryEntryFor(url: string): RegistryEntry | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  // Longest domain first, so a specific entry beats a broader parent domain.
  const candidates = SEED_REGISTRY.filter((entry) => matches(hostname, entry.domain)).sort(
    (a, b) => b.domain.length - a.domain.length,
  );
  return candidates[0] ?? null;
}

export function classifyDomain(url: string): RegistryClass | null {
  return registryEntryFor(url)?.class ?? null;
}
