import type { LedgerInput, CompoundInput, Verdict, TreeId, ClaimType, Tree2Extension, Tree3Extension, Tree4Extension } from './schema/ledger.js';
import { validateLedgerInput, validateCompoundInput, makeRefusal } from './schema/validate.js';
import { bandRank } from './schema/bandOrder.js';
import { normalize, type NormalizedLedger } from './normalize/index.js';
import { evaluateTree1 } from './trees/tree1-simple-factual.js';
import { evaluateTree2 } from './trees/tree2-causal.js';
import { evaluateTree3 } from './trees/tree3-predictive.js';
import { evaluateTree4 } from './trees/tree4-complex-system.js';
import type { TreeResult } from './trees/types.js';
import { assembleVerdict } from './verdict/assemble.js';
import { evaluateAggregate } from './aggregate/compound.js';
import { ENGINE_VERSION, SCHEMA_VERSION } from './schema/version.js';

export type { LedgerInput, CompoundInput, Verdict } from './schema/ledger.js';
export { ENGINE_VERSION, SCHEMA_VERSION } from './schema/version.js';

function isTree2Extension(x: unknown): x is Tree2Extension {
  return typeof x === 'object' && x !== null && 'underlyingFactualBand' in x;
}
function isTree3Extension(x: unknown): x is Tree3Extension {
  return typeof x === 'object' && x !== null && 'meetsEstablishedShapedConditions' in x;
}
function isTree4Extension(x: unknown): x is Tree4Extension {
  return typeof x === 'object' && x !== null && 'decomposable' in x;
}

/** Dispatches classification.primary/alternative to the matching tree (T048). */
function runTree(
  claimType: ClaimType,
  ledger: LedgerInput,
  normalized: NormalizedLedger,
): { treeId: TreeId; result: TreeResult } | null {
  switch (claimType) {
    case 'simple_factual':
      return { treeId: 'tree1_simple_factual', result: evaluateTree1(ledger, normalized) };
    case 'causal':
      return isTree2Extension(ledger.treeExtension)
        ? { treeId: 'tree2_causal', result: evaluateTree2(ledger.treeExtension) }
        : null;
    case 'predictive':
      return isTree3Extension(ledger.treeExtension)
        ? { treeId: 'tree3_predictive', result: evaluateTree3(ledger.treeExtension) }
        : null;
    case 'complex_system':
      return isTree4Extension(ledger.treeExtension)
        ? { treeId: 'tree4_complex_system', result: evaluateTree4(ledger.treeExtension) }
        : null;
    default:
      return null;
  }
}

/**
 * Evaluate a single claim's ledger and return a Verdict. Never throws for
 * malformed input — see contracts/engine-api.md.
 */
export function evaluate(input: LedgerInput): Verdict {
  const validated = validateLedgerInput(input);
  if (!validated.ok) {
    return makeRefusal(validated.reason);
  }
  const ledger = validated.value;

  // FR-033: falsifiability screen short-circuits before normalize() or any tree runs.
  if (ledger.screens.falsifiability === 'fired') {
    return {
      band: 'unfalsifiable',
      qualifier: null,
      tree: 'screen',
      conditionsMet: [{ id: 'SCREEN-UNFALSIFIABLE', protocolClause: 'Step 1: falsifiability screen fired' }],
      cappingConditions: [],
      engineVersion: ENGINE_VERSION,
      schemaVersion: SCHEMA_VERSION,
      dependenceMap: null,
      residue: null,
      movedBy: null,
      refusalReason: null,
    };
  }

  const normalized = normalize(ledger);

  const primaryRun = runTree(ledger.classification.primary, ledger, normalized);
  if (!primaryRun) {
    return makeRefusal(
      `treeExtension does not match classification.primary '${ledger.classification.primary}'`,
    );
  }

  // FR-030: when confidence is low and a genuinely plausible alternative type
  // is named, run both trees and report the lower band with both shown.
  if (ledger.classification.confidence === 'low' && ledger.classification.alternative) {
    const altRun = runTree(ledger.classification.alternative, ledger, normalized);
    if (altRun) {
      const lower = bandRank(altRun.result.band) < bandRank(primaryRun.result.band) ? altRun : primaryRun;
      const dualRouteNote = {
        id: 'DUAL-ROUTE',
        protocolClause: `FR-030: low-confidence dual-tree routing — ${primaryRun.treeId}=${primaryRun.result.band ?? 'null'}, ${altRun.treeId}=${altRun.result.band ?? 'null'}; lower band reported`,
      };
      return assembleVerdict(
        lower.treeId,
        { ...lower.result, conditionsMet: [...lower.result.conditionsMet, dualRouteNote] },
        { dependenceMap: lower.treeId === 'tree1_simple_factual' ? normalized.dependenceMap : null },
      );
    }
  }

  return assembleVerdict(primaryRun.treeId, primaryRun.result, {
    dependenceMap: primaryRun.treeId === 'tree1_simple_factual' ? normalized.dependenceMap : null,
  });
}

/**
 * Aggregate a compound claim from already-computed sub-claim bands. See
 * contracts/engine-api.md for the `previous` recompute contract.
 */
export function aggregate(
  input: CompoundInput,
  previous?: { subClaims: CompoundInput['subClaims'] },
): Verdict {
  const validated = validateCompoundInput(input);
  if (!validated.ok) {
    return makeRefusal(validated.reason);
  }
  return evaluateAggregate(validated.value, previous);
}
