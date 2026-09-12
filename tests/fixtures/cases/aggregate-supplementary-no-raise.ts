import type { AggregateFixtureCase } from '../helpers.js';

export const case_: AggregateFixtureCase = {
  kind: 'aggregate',
  id: 'aggregate-supplementary-no-raise',
  protocolClause: 'AGENT-PROTOCOL-v3.md aggregation, FR-036 (a supplementary sub-claim never raises the compound band)',
  input: {
    subClaims: [
      { id: 'sc-a', band: 'probable', edgeType: 'load_bearing' },
      { id: 'sc-b', band: 'established', edgeType: 'supplementary' },
    ],
    edges: [],
  },
  expected: { band: 'probable', tree: 'aggregation' },
};
