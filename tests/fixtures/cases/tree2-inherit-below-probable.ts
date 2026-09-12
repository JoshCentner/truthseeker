import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree2-inherit-below-probable',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 2, FR-025 (inherit underlying factual band below Probable)',
  input: baseLedger({
    classification: { primary: 'causal', confidence: 'high' },
    treeExtension: {
      underlyingFactualBand: 'contested',
      temporalityFinding: 'established',
      discriminatingCriterionMet: true,
      supportiveCriteriaCount: 0,
    },
  }),
  expected: { band: 'contested', tree: 'tree2_causal' },
};
