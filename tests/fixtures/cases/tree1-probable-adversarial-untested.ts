import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-probable-adversarial-untested',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Probable (adversarial status Untested caps Established)',
  input: baseLedger({
    origins: [makeOrigin('o1'), makeOrigin('o2')],
    warrants: [makeWarrant('o1'), makeWarrant('o2')],
    diagnosticityEntries: [
      { lineOriginId: 'o1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'o2', against: 'claim', mark: 'consistent' },
    ],
    adversarialStatus: 'untested',
    silenceFinding: 'none',
  }),
  expected: { band: 'probable', tree: 'tree1_simple_factual' },
};
