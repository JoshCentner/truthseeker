import type { Verdict, TreeId } from '../schema/ledger.js';
import type { TreeResult } from '../trees/types.js';
import { ENGINE_VERSION, SCHEMA_VERSION } from '../schema/version.js';

const HIGHEST_REACHABLE: Record<TreeId, Verdict['band']> = {
  tree1_simple_factual: 'established',
  tree2_causal: 'established',
  tree3_predictive: 'probable', // FR-028: Established is unreachable on Tree 3.
  tree4_complex_system: 'established',
  aggregation: 'established',
  screen: 'unfalsifiable',
};

/**
 * FR-042/FR-043/FR-045/FR-046: attaches tree id and version stamps to a tree's
 * raw result, and asserts (defensively, in addition to each tree's own logic)
 * that a below-ceiling band always carries at least one capping condition.
 */
export function assembleVerdict(
  tree: TreeId,
  result: TreeResult,
  extra: Partial<Pick<Verdict, 'dependenceMap' | 'residue' | 'movedBy'>> = {},
): Verdict {
  const ceiling = HIGHEST_REACHABLE[tree];
  // FR-043 applies to a computed, below-ceiling band. A null band (Tree 4's
  // decomposable branch — routed elsewhere, not capped) is exempt: there is
  // no band to cap.
  const belowCeiling = result.band !== null && result.band !== ceiling;
  const cappingConditions =
    belowCeiling && result.cappingConditions.length === 0
      ? [{ id: 'CAP-UNSPECIFIED', protocolClause: `band below ${tree}'s ceiling with no capping condition recorded` }]
      : result.cappingConditions;

  return {
    band: result.band,
    qualifier: result.qualifier,
    tree,
    conditionsMet: result.conditionsMet,
    cappingConditions,
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    dependenceMap: extra.dependenceMap ?? null,
    residue: extra.residue ?? result.residue ?? null,
    movedBy: extra.movedBy ?? null,
    refusalReason: null,
  };
}
