import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

/**
 * Regression fixture for the defect found on 2026-09-15: before engine 0.2.0
 * this exact ledger returned `established`, because every surviving diagnostic
 * line counted toward corroboration regardless of whether it agreed with the
 * claim. Two independent contemporaneous-record clusters flatly contradicting a
 * claim must refute it, never establish it.
 */
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-refuted-by-counter-evidence',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Refuted — mirrored Established bar on counter-evidence',
  input: baseLedger({
    claimRestatement: 'The Earth is flat.',
    origins: [makeOrigin('o1'), makeOrigin('o2')],
    warrants: [makeWarrant('o1'), makeWarrant('o2')],
    diagnosticityEntries: [
      { lineOriginId: 'o1', against: 'claim', mark: 'inconsistent' },
      { lineOriginId: 'o2', against: 'claim', mark: 'inconsistent' },
    ],
    adversarialStatus: 'survived',
    silenceFinding: 'none',
  }),
  expected: { band: 'refuted', tree: 'tree1_simple_factual' },
};
