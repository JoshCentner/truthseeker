import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

/**
 * FR-034's conflicting-evidence branch, which the engine previously documented
 * as unreachable because it could not tell the two sides of a claim apart. With
 * diagnosticity marks separating them it fires on an exact match of grade AND
 * cluster count: two contemporaneous-record clusters for, two against.
 */
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-contested-conflicting-evidence',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Contested (conflicting evidence) — FR-034 exact match on both sides',
  input: baseLedger({
    origins: [makeOrigin('for1'), makeOrigin('for2'), makeOrigin('against1'), makeOrigin('against2')],
    warrants: [makeWarrant('for1'), makeWarrant('for2'), makeWarrant('against1'), makeWarrant('against2')],
    diagnosticityEntries: [
      { lineOriginId: 'for1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'for2', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'against1', against: 'claim', mark: 'inconsistent' },
      { lineOriginId: 'against2', against: 'claim', mark: 'inconsistent' },
    ],
    adversarialStatus: 'survived',
  }),
  expected: { band: 'contested', qualifier: 'conflicting_evidence', tree: 'tree1_simple_factual' },
};
