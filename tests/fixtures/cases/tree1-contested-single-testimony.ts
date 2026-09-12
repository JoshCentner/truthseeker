import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-contested-single-testimony',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Contested (sole support is one post-dispute testimony cluster)',
  input: baseLedger({
    origins: [makeOrigin('o1')],
    warrants: [makeWarrant('o1', { startingGrade: 'testimony' })],
    diagnosticityEntries: [{ lineOriginId: 'o1', against: 'claim', mark: 'consistent' }],
  }),
  expected: { band: 'contested', qualifier: 'insufficient_evidence', tree: 'tree1_simple_factual' },
};
