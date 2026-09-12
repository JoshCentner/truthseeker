import type { Tree3Extension, ConditionRef } from '../schema/ledger.js';
import type { TreeResult } from './types.js';

const cond = (id: string, protocolClause: string): ConditionRef => ({ id, protocolClause });

/** Tree 3 (predictive claims). FR-028: capped at Probable under all inputs. */
export function evaluateTree3(ext: Tree3Extension): TreeResult {
  if (ext.meetsEstablishedShapedConditions) {
    return {
      band: 'probable',
      qualifier: null,
      conditionsMet: [cond('T3-ESTABLISHED-SHAPED', 'FR-028: meets every Established-shaped condition')],
      cappingConditions: [cond('T3-CAP-CEILING', 'FR-028: Established is unreachable on Tree 3 under all inputs')],
    };
  }
  return {
    band: 'contested',
    qualifier: 'insufficient_evidence',
    conditionsMet: [],
    cappingConditions: [cond('T3-CAP-CONDITIONS-NOT-MET', 'Established-shaped conditions not met')],
  };
}
