import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

/**
 * The supporting side meets every Established floor on its own — two
 * contemporaneous-record clusters, no unrebutted rival, no strong silence,
 * adversarial survived — but a weaker line still contradicts the claim. A claim
 * cannot be Established while surviving diagnostic evidence points the other
 * way, so it caps at Probable with the counter-evidence named as the capping
 * condition.
 */
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-counter-evidence-blocks-established',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Established requires no surviving counter-evidence',
  input: baseLedger({
    origins: [makeOrigin('for1'), makeOrigin('for2'), makeOrigin('against1')],
    warrants: [
      makeWarrant('for1'),
      makeWarrant('for2'),
      makeWarrant('against1', { startingGrade: 'testimony' }),
    ],
    diagnosticityEntries: [
      { lineOriginId: 'for1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'for2', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'against1', against: 'claim', mark: 'inconsistent' },
    ],
    adversarialStatus: 'survived',
  }),
  expected: { band: 'probable', tree: 'tree1_simple_factual' },
};
