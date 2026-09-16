import type { CandidateOrigin, RegistryClass } from './types.js';
import { classifyDomain, registryEntryFor } from './registry.js';

/**
 * The deterministic source gate.
 *
 * The constitution has required this from the start — "Deterministic checks run
 * on every run. At minimum: ... no origin's domain is classed aggregator" — but
 * until now nothing enforced it. `classifyDomain()` was advisory: an aggregator
 * got a NOTE appended to its grading prompt asking the model to trace through
 * to what the aggregator rested on, and was then graded and counted like any
 * other source. That made the rule a suggestion addressed to a model rather
 * than a property of the system, which is exactly the inversion Principle I
 * exists to prevent.
 *
 * It is now a gate. A blocked source is refused before it can become an origin,
 * by code, with no model involved in the decision.
 *
 * WHY EXCLUSION RATHER THAN DOWN-WEIGHTING. An aggregator is not weak evidence;
 * it is not evidence at all. It is a pointer to evidence held somewhere else.
 * Admitting one and grading it down still lets it occupy a cluster and count
 * toward corroboration, which double-counts whatever original source it was
 * summarising and silently inflates the independence of the evidence base — the
 * "same evidence twice under two names" corruption the constitution names as a
 * silent, systematic error. The correct handling is to trace through to the
 * original and cite that; until automated substitution exists (tracked in
 * PROJECT-TRACKER.md), the correct handling is to refuse.
 *
 * NOT A SILENT FILTER. Every exclusion is recorded and surfaced in the run
 * trace and on the generated report, for the same reason Principle VI requires
 * a rejection to state the rule that fired: a filter nobody can inspect is
 * indistinguishable from a bug.
 */

/**
 * Registry classes that disqualify a source outright.
 *
 * Only `aggregator` blocks. The other three classes are contextual signals, not
 * disqualifications, and conflating them would be wrong in both directions:
 *  - `press_release` IS the original document when the claim is about what an
 *    organisation said. It is a primary source for its own contents.
 *  - `preprint` is not peer reviewed, which the warrant rubric already handles
 *    through its downgrade triggers. Excluding preprints would discard genuine
 *    primary research.
 *  - `paywalled` describes access, not provenance. retrieve.ts already records
 *    an unreadable page as could_not_retrieve.
 */
export const BLOCKED_REGISTRY_CLASSES: ReadonlySet<RegistryClass> = new Set<RegistryClass>(['aggregator']);

export interface SourceScreening {
  url: string;
  admitted: boolean;
  registryClass: RegistryClass | null;
  /** Present only when admitted is false. Names the rule and the reason. */
  reason?: string;
}

/** The deterministic check. No model input, no heuristics, no judgement. */
export function screenSource(url: string): SourceScreening {
  const registryClass = classifyDomain(url);
  if (registryClass === null || !BLOCKED_REGISTRY_CLASSES.has(registryClass)) {
    return { url, admitted: true, registryClass };
  }
  const entry = registryEntryFor(url);
  return {
    url,
    admitted: false,
    registryClass,
    reason:
      `blocked by the structural source registry: domain is classed "${registryClass}". ` +
      `${entry?.note ?? ''} An aggregator is a pointer to evidence, not evidence: admitting one lets it ` +
      `occupy a cluster and count toward corroboration, double-counting whatever original source it ` +
      `summarises. Cite that original instead.`.trim(),
  };
}

export interface PartitionedCandidates {
  admitted: CandidateOrigin[];
  excluded: SourceScreening[];
}

/** Splits discovered candidates before any fetch is attempted, so a blocked
 * domain costs no network request and never reaches a grading step. */
export function partitionCandidates(candidates: CandidateOrigin[]): PartitionedCandidates {
  const admitted: CandidateOrigin[] = [];
  const excluded: SourceScreening[] = [];
  for (const candidate of candidates) {
    const screening = screenSource(candidate.url);
    if (screening.admitted) admitted.push(candidate);
    else excluded.push(screening);
  }
  return { admitted, excluded };
}

export class BlockedSourceError extends Error {}

/**
 * The hard gate. Called at ledger assembly, after every other path has had its
 * chance to introduce an origin — search results, a hand-written manual-run
 * transcript, a future importer. Filtering at discovery is the cheap path;
 * this is the one that makes the guarantee, because it is downstream of
 * everything.
 */
export function assertNoBlockedOrigins(originIds: string[]): void {
  const offenders = originIds.map(screenSource).filter((s) => !s.admitted);
  if (offenders.length === 0) return;
  throw new BlockedSourceError(
    `${offenders.length} origin(s) reached ledger assembly from a blocked domain. This is a bug in whatever ` +
      `supplied them — the constitution requires that no origin's domain is classed aggregator:\n` +
      offenders.map((o) => `  ${o.url}\n    ${o.reason}`).join('\n'),
  );
}

/**
 * Offline re-validation of a stored ledger's origins. Deliberately returns
 * findings rather than throwing: the registry is curated and grows, so a domain
 * added today would retroactively invalidate records committed in good faith
 * last month. Those records stay readable and are flagged on their page instead,
 * which is the honest treatment — the record was correct under the rules in
 * force when it was made, and the reader should see both facts.
 */
export function findBlockedOrigins(originIds: string[]): SourceScreening[] {
  return originIds.map(screenSource).filter((s) => !s.admitted);
}
