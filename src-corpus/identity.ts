import { createHash } from 'node:crypto';

/**
 * Claim identity (contracts/claim-record.md, research.md §5).
 *
 * The id is readable-slug + content-hash. That combination buys three things at
 * once that no single scheme gives:
 *
 *  - Byte-identical restatements produce identical ids, so FR-007's
 *    auto-linking falls out of the naming scheme rather than needing a separate
 *    index that could drift out of sync with the filesystem.
 *  - Distinct restatements cannot collide, so no order-dependent disambiguation
 *    suffix is needed. A suffix scheme would give the same two claims different
 *    ids depending on which was added first, breaking determinism and any link
 *    already made.
 *  - Identity is verifiable from the filesystem alone: re-derive the id from
 *    the restatement and compare it to the directory name. That check is what
 *    enforces FR-007a's immutability, with no extra bookkeeping.
 */

const READABLE_MAX = 48;
const HASH_LENGTH = 8;

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Lowercase, collapse non-alphanumerics to single hyphens, trim, truncate at a
 * hyphen boundary so a truncated slug never ends mid-word. */
function readablePart(restatement: string): string {
  const slug = restatement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= READABLE_MAX) return slug;
  const cut = slug.slice(0, READABLE_MAX);
  const lastHyphen = cut.lastIndexOf('-');
  return lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut;
}

/**
 * Derives a claim's directory id from its canonical restatement. The hash is
 * taken over the FULL, untruncated, untransformed restatement, so two
 * restatements differing only beyond the truncation point — or only in
 * punctuation the slug strips — still produce different ids.
 */
export function claimIdFor(canonicalRestatement: string): string {
  const readable = readablePart(canonicalRestatement);
  const hash = sha256Hex(canonicalRestatement).slice(0, HASH_LENGTH);
  return readable.length > 0 ? `${readable}-${hash}` : hash;
}

/**
 * A harm-gate rejection's id (research.md §6). Derived from the run id alone —
 * deliberately NOT from the claim text, because a slug derived from a rejected
 * claim republishes it in every directory listing, link and diff just as
 * effectively as printing it on the page would.
 */
export function rejectionIdFor(runId: string): string {
  return `rejected-${sha256Hex(runId).slice(0, 16)}`;
}

/** True when a directory name is the id its restatement derives. The check that
 * makes FR-007a's immutability enforceable rather than merely stated. */
export function idMatchesRestatement(id: string, canonicalRestatement: string): boolean {
  return id === claimIdFor(canonicalRestatement);
}
