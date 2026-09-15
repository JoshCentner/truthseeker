import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

/**
 * Counter-evidence exists but does not clear the refutation bar (one cluster,
 * not two). Principle II's burden rule decides the rest: nothing is marked
 * consistent with the claim, so the claimant's burden is simply unmet and the
 * band is Unsupported — not Contested, which would imply a live two-sided
 * dispute, and not Refuted, which the opposing side has not earned.
 */
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-unsupported-counter-below-bar',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Unsupported — burden unmet, counter-evidence below the refutation bar',
  input: baseLedger({
    origins: [makeOrigin('o1')],
    warrants: [makeWarrant('o1')],
    diagnosticityEntries: [{ lineOriginId: 'o1', against: 'claim', mark: 'inconsistent' }],
    adversarialStatus: 'survived',
  }),
  expected: { band: 'unsupported', tree: 'tree1_simple_factual' },
};
