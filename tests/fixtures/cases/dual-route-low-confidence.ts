import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

// Tree 1 (primary) would reach Established from these two clusters; Tree 2
// (alternative) inherits 'contested' from its underlying factual band. FR-030
// requires reporting the lower of the two — contested.
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'dual-route-low-confidence',
  protocolClause: 'AGENT-PROTOCOL-v3.md Step 1 classification, FR-030 (low confidence, two plausible types, lower band reported)',
  input: baseLedger({
    classification: { primary: 'simple_factual', confidence: 'low', alternative: 'causal' },
    origins: [makeOrigin('o1'), makeOrigin('o2')],
    warrants: [makeWarrant('o1'), makeWarrant('o2')],
    diagnosticityEntries: [
      { lineOriginId: 'o1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'o2', against: 'claim', mark: 'consistent' },
    ],
    treeExtension: {
      underlyingFactualBand: 'contested',
      temporalityFinding: 'established',
      discriminatingCriterionMet: true,
      supportiveCriteriaCount: 0,
    },
  }),
  expected: { band: 'contested', tree: 'tree2_causal' },
};
