import type { AggregateFixtureCase } from '../helpers.js';

export const case_: AggregateFixtureCase = {
  kind: 'aggregate',
  id: 'aggregate-recompute-moved-by',
  protocolClause: 'AGENT-PROTOCOL-v3.md aggregation, FR-039 (recompute from a changed sub-claim band names which one moved it)',
  previous: {
    subClaims: [
      { id: 'sc-a', band: 'established', edgeType: 'load_bearing' },
      { id: 'sc-b', band: 'established', edgeType: 'load_bearing' },
    ],
  },
  input: {
    subClaims: [
      { id: 'sc-a', band: 'established', edgeType: 'load_bearing' },
      { id: 'sc-b', band: 'contested', edgeType: 'load_bearing' },
    ],
    edges: [],
  },
  expected: { band: 'contested', qualifier: 'insufficient_evidence', tree: 'aggregation', movedBy: 'sc-b' },
};
