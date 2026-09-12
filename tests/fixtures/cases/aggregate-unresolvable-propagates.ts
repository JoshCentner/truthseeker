import type { AggregateFixtureCase } from '../helpers.js';

export const case_: AggregateFixtureCase = {
  kind: 'aggregate',
  id: 'aggregate-unresolvable-propagates',
  protocolClause: 'AGENT-PROTOCOL-v3.md aggregation, FR-038 (any load-bearing Unresolvable sub-claim makes the compound Unresolvable)',
  input: {
    subClaims: [
      { id: 'sc-a', band: 'established', edgeType: 'load_bearing' },
      { id: 'sc-b', band: 'unresolvable', edgeType: 'load_bearing' },
    ],
    edges: [],
  },
  expected: { band: 'unresolvable', tree: 'aggregation' },
};
