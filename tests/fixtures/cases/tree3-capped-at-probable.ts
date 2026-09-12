import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree3-capped-at-probable',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 3, FR-028 (Established unreachable — capped at Probable)',
  input: baseLedger({
    classification: { primary: 'predictive', confidence: 'high' },
    treeExtension: { meetsEstablishedShapedConditions: true },
  }),
  expected: { band: 'probable', tree: 'tree3_predictive' },
};
