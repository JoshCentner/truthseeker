import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree4-irreducible',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 4, FR-029 (irreducible complex-system claim returns Unresolvable with rationale)',
  input: baseLedger({
    classification: { primary: 'complex_system', confidence: 'high' },
    treeExtension: {
      decomposable: false,
      whyNoHonestBand: 'the sub-claims cannot be independently assessed without begging the question',
      evidenceThatWouldChangeIt: 'a decomposition method that isolates genuinely independent sub-claims',
    },
  }),
  expected: { band: 'unresolvable', tree: 'tree4_complex_system' },
};
