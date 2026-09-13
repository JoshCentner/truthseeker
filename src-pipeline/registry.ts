import type { RegistryEntry, RegistryClass } from './types.js';

/**
 * FR-037, FR-039: a small, seed, curated list — not a comprehensive or
 * actively-maintained system (spec.md Assumptions). Extending this list is
 * reasonable future follow-up work, not a blocker to functioning correctly
 * on the domains it does know about.
 */
export const SEED_REGISTRY: RegistryEntry[] = [
  { domain: 'news.google.com', class: 'aggregator', note: 'Aggregates headlines from other outlets; never itself the original reporting.' },
  { domain: 'apple.news', class: 'aggregator', note: 'Aggregates articles from other publishers.' },
  { domain: 'flipboard.com', class: 'aggregator', note: 'User-curated aggregation of other outlets\u2019 content.' },
  { domain: 'msn.com', class: 'aggregator', note: 'Syndicates and re-publishes wire and partner content, not original reporting.' },
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
export function classifyDomain(url: string): RegistryClass | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const entry of SEED_REGISTRY) {
    if (hostname === entry.domain || hostname.endsWith(`.${entry.domain}`)) {
      return entry.class;
    }
  }
  return null;
}
