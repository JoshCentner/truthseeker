import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-contested-nondiagnostic',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Contested (every surviving line non-diagnostic)',
  input: baseLedger({
    origins: [makeOrigin('o1')],
    warrants: [makeWarrant('o1')],
    rivals: [{ id: 'r1', description: 'An unrebutted live rival', rebutted: false, plausibilityRelativeToClaim: 'less_or_equally_plausible' }],
    diagnosticityEntries: [
      { lineOriginId: 'o1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'o1', against: { rivalId: 'r1' }, mark: 'consistent' },
    ],
  }),
  expected: { band: 'contested', qualifier: 'insufficient_evidence', tree: 'tree1_simple_factual' },
};
