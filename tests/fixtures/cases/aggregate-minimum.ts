import type { AggregateFixtureCase } from '../helpers.js';

export const case_: AggregateFixtureCase = {
  kind: 'aggregate',
  id: 'aggregate-minimum',
  protocolClause: 'AGENT-PROTOCOL-v3.md aggregation, FR-035 (compound band = minimum across load-bearing sub-claims)',
  input: {
    subClaims: [
      { id: 'sc-a', band: 'established', edgeType: 'load_bearing' },
      { id: 'sc-b', band: 'probable', edgeType: 'load_bearing' },
      { id: 'sc-c', band: 'contested', edgeType: 'load_bearing' },
    ],
    edges: [],
  },
  expected: { band: 'contested', qualifier: 'insufficient_evidence', tree: 'aggregation' },
};
