import type { Tree4Extension, ConditionRef } from '../schema/ledger.js';
import type { TreeResult } from './types.js';

const cond = (id: string, protocolClause: string): ConditionRef => ({ id, protocolClause });

/** Tree 4 (complex-system claims). FR-029. */
export function evaluateTree4(ext: Tree4Extension): TreeResult {
  if (ext.decomposable) {
    return {
      band: null, // routed elsewhere — see TreeResult's doc comment.
      qualifier: null,
      conditionsMet: [cond('T4-DECOMPOSED', `FR-029: routed to sub-claims [${ext.subClaimIds.join(', ')}]`)],
      cappingConditions: [],
      residue: ext.subClaimIds.length === 0 ? 'no sub-claims captured for this decomposition' : null,
    };
  }
  return {
    band: 'unresolvable',
    qualifier: null,
    conditionsMet: [],
    cappingConditions: [
      cond('T4-CAP-WHY', ext.whyNoHonestBand),
      cond('T4-CAP-EVIDENCE-NEEDED', ext.evidenceThatWouldChangeIt),
    ],
    residue: null,
  };
}
