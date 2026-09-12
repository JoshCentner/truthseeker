import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree2-no-temporality',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 2, FR-026 (no temporality finding disqualifies above Doubtful)',
  input: baseLedger({
    classification: { primary: 'causal', confidence: 'high' },
    treeExtension: {
      underlyingFactualBand: 'probable',
      temporalityFinding: 'absent',
      discriminatingCriterionMet: true,
      supportiveCriteriaCount: 0,
    },
  }),
  expected: { band: 'doubtful', tree: 'tree2_causal' },
};
