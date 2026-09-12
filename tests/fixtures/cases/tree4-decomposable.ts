import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree4-decomposable',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 4, FR-029 (decomposable complex-system claim routes to sub-claim trees)',
  input: baseLedger({
    classification: { primary: 'complex_system', confidence: 'high' },
    treeExtension: { decomposable: true, subClaimIds: ['sc-1', 'sc-2'] },
  }),
  expected: { band: null, tree: 'tree4_complex_system' },
};
