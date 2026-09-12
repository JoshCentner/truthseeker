import type { Tree2Extension, ConditionRef, Band } from '../schema/ledger.js';
import type { TreeResult } from './types.js';

const cond = (id: string, protocolClause: string): ConditionRef => ({ id, protocolClause });
const REACHED_PROBABLE_OR_ABOVE: Band[] = ['probable', 'established'];

/** Tree 2 (causal claims). FR-025, FR-026, FR-027. */
export function evaluateTree2(ext: Tree2Extension): TreeResult {
  // FR-025: inherit the lower band and stop evaluation when the underlying
  // factual claims did not reach Probable.
  if (!REACHED_PROBABLE_OR_ABOVE.includes(ext.underlyingFactualBand)) {
    return {
      band: ext.underlyingFactualBand,
      qualifier: null,
      conditionsMet: [cond('T2-INHERIT', 'FR-025: underlying factual band did not reach Probable')],
      cappingConditions: [
        cond('T2-CAP-INHERIT', `causal claim inherits underlying factual band '${ext.underlyingFactualBand}'`),
      ],
    };
  }

  // FR-026: temporality is a necessary condition; its absence disqualifies
  // every band above Doubtful.
  if (ext.temporalityFinding === 'absent') {
    return {
      band: 'doubtful',
      qualifier: null,
      conditionsMet: [],
      cappingConditions: [cond('T2-CAP-TEMPORALITY', 'FR-026: no temporality finding — disqualifies every band above Doubtful')],
    };
  }

  // FR-027: the discriminating criterion is an existence condition; supportive
  // criteria cannot satisfy it at any quantity.
  if (!ext.discriminatingCriterionMet) {
    return {
      band: 'contested',
      qualifier: 'insufficient_evidence',
      conditionsMet: [
        cond('T2-SUPPORTIVE-ONLY', `FR-027: ${ext.supportiveCriteriaCount} supportive criteria met, no discriminating criterion`),
      ],
      cappingConditions: [
        cond('T2-CAP-NO-DISCRIMINATING', 'discriminating criterion is an existence condition; supportive criteria alone cannot satisfy it at any quantity'),
      ],
    };
  }

  // Temporality holds and the discriminating criterion is met. This feature's
  // functional requirements (FR-025-FR-027) do not specify Tree 2's full
  // Established condition set beyond these three gates — consistent with
  // Constitution Principle I's anti-overclaim stance, this returns Probable
  // rather than assuming Established.
  return {
    band: 'probable',
    qualifier: null,
    conditionsMet: [cond('T2-DISCRIMINATING-MET', 'FR-027: discriminating criterion satisfied; temporality holds')],
    cappingConditions: [
      cond('T2-CAP-SCOPE', "Tree 2's full Established condition set beyond the discriminating criterion is outside this feature's specified scope"),
    ],
  };
}
