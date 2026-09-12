import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree2-supportive-only',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 2, FR-027 (supportive criteria alone, any quantity, cannot satisfy the discriminating existence condition)',
  input: baseLedger({
    classification: { primary: 'causal', confidence: 'high' },
    treeExtension: {
      underlyingFactualBand: 'probable',
      temporalityFinding: 'established',
      discriminatingCriterionMet: false,
      supportiveCriteriaCount: 5,
    },
  }),
  expected: { band: 'contested', qualifier: 'insufficient_evidence', tree: 'tree2_causal' },
};
