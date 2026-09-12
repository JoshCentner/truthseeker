import type { CompoundInput, Verdict, CompoundSubClaim, ConditionRef } from '../schema/ledger.js';
import { makeRefusal } from '../schema/validate.js';
import { bandRank, lowerBand, stepDownBand } from '../schema/bandOrder.js';
import type { TreeResult } from '../trees/types.js';
import { assembleVerdict } from '../verdict/assemble.js';

const cond = (id: string, protocolClause: string): ConditionRef => ({ id, protocolClause });

/** FR-040: refuse rather than recurse on a cyclic sub-claim structure. */
function hasCycle(edges: { from: string; to: string }[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const bucket = adjacency.get(e.from) ?? [];
    bucket.push(e.to);
    adjacency.set(e.from, bucket);
  }
  const WHITE = 0,
    GRAY = 1,
    BLACK = 2;
  const color = new Map<string, number>();
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.from);
    nodes.add(e.to);
  }
  for (const n of nodes) color.set(n, WHITE);

  function visit(node: string): boolean {
    color.set(node, GRAY);
    for (const next of adjacency.get(node) ?? []) {
      const c = color.get(next);
      if (c === GRAY) return true; // back edge -> cycle
      if (c === WHITE && visit(next)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const n of nodes) {
    if (color.get(n) === WHITE && visit(n)) return true;
  }
  return false;
}

/** Names which sub-claim changed, when exactly one differs from `previous` (FR-039). */
function findMovedBy(input: CompoundInput, previous?: { subClaims: CompoundSubClaim[] }): string | null {
  if (!previous) return null;
  const prevById = new Map(previous.subClaims.map((s) => [s.id, s.band] as const));
  const changed = input.subClaims.filter((s) => prevById.has(s.id) && prevById.get(s.id) !== s.band);
  return changed.length === 1 ? (changed[0] as CompoundSubClaim).id : null;
}

/**
 * FR-035-FR-041: aggregate a compound claim's band from its sub-claims' bands.
 *
 * The multi-cluster carve-out (FR-041) needs no code here: converging
 * independent evidence clusters on a single claim are counted during
 * normalization (src/normalize/clusters.ts), never modeled as CompoundInput
 * sub-claims, so this function's rules simply never see them.
 */
export function evaluateAggregate(
  input: CompoundInput,
  previous?: { subClaims: CompoundSubClaim[] },
): Verdict {
  if (hasCycle(input.edges)) {
    return makeRefusal('FR-040: sub-claim structure contains a cycle; aggregation refuses rather than recursing');
  }

  const loadBearing = input.subClaims.filter((s) => s.edgeType === 'load_bearing');
  const supplementary = input.subClaims.filter((s) => s.edgeType === 'supplementary');
  const movedBy = findMovedBy(input, previous);

  // FR-038: any load-bearing sub-claim Unresolvable makes the compound Unresolvable immediately.
  const unresolvableCulprit = loadBearing.find((s) => s.band === 'unresolvable');
  if (unresolvableCulprit) {
    const result: TreeResult = {
      band: 'unresolvable',
      qualifier: null,
      conditionsMet: [cond('AGG-UNRESOLVABLE-PROPAGATED', `FR-038: load-bearing sub-claim '${unresolvableCulprit.id}' is Unresolvable`)],
      cappingConditions: [cond('AGG-CAP-UNRESOLVABLE', `capped by load-bearing sub-claim '${unresolvableCulprit.id}'`)],
    };
    return assembleVerdict('aggregation', result, { movedBy });
  }

  if (loadBearing.length === 0) {
    return makeRefusal('aggregation requires at least one load-bearing sub-claim');
  }

  // FR-035: compound band = minimum across load-bearing sub-claims.
  const minimumSubClaim = loadBearing.reduce((worst, s) => (bandRank(s.band) < bandRank(worst.band) ? s : worst));
  let band = minimumSubClaim.band;
  const conditionsMet: ConditionRef[] = [
    cond('AGG-MINIMUM', `FR-035: minimum of ${loadBearing.length} load-bearing sub-claim(s), set by '${minimumSubClaim.id}'`),
  ];
  const cappingConditions: ConditionRef[] = [];
  if (band !== 'established') {
    cappingConditions.push(cond('AGG-CAP-MINIMUM', `capped by load-bearing sub-claim '${minimumSubClaim.id}' at band '${band}'`));
  }

  // FR-036/FR-037 (clarified): supplementary sub-claims never raise the band;
  // two or more independently failing supplementary sub-claims lower it by
  // exactly one step. "Failing" = ranked below the compound's current band.
  const failingSupplementary = supplementary.filter((s) => bandRank(s.band) < bandRank(band));
  if (failingSupplementary.length >= 2) {
    const demoted = stepDownBand(band);
    cappingConditions.push(
      cond(
        'AGG-CAP-SUPPLEMENTARY-DEMOTION',
        `FR-037: demoted from '${band}' to '${demoted}' by ${failingSupplementary.length} independently failing supplementary sub-claims (${failingSupplementary.map((s) => s.id).join(', ')})`,
      ),
    );
    band = demoted;
  }

  const result: TreeResult = {
    band,
    qualifier: band === 'contested' ? 'insufficient_evidence' : null,
    conditionsMet,
    cappingConditions,
  };
  return assembleVerdict('aggregation', result, { movedBy });
}
