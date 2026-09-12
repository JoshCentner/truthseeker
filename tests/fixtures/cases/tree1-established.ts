import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-established',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Established',
  input: baseLedger({
    origins: [makeOrigin('o1'), makeOrigin('o2')],
    warrants: [makeWarrant('o1'), makeWarrant('o2')],
    diagnosticityEntries: [
      { lineOriginId: 'o1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'o2', against: 'claim', mark: 'consistent' },
    ],
    adversarialStatus: 'survived',
    silenceFinding: 'none',
  }),
  expected: { band: 'established', tree: 'tree1_simple_factual' },
};
