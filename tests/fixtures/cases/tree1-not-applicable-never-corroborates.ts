import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

/**
 * A line marked not_applicable has no bearing on the claim and must not count
 * toward the two-cluster corroboration floor. Before engine 0.2.0 it did: the
 * Great Wall live run reported "cluster count = 3" from one irrelevant line and
 * two that contradicted the claim. Here only one line genuinely supports the
 * claim, so Established and Probable are both out of reach.
 */
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-not-applicable-never-corroborates',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, FR-024 corroboration counts only supporting clusters',
  input: baseLedger({
    origins: [makeOrigin('supports'), makeOrigin('irrelevant')],
    warrants: [makeWarrant('supports'), makeWarrant('irrelevant')],
    diagnosticityEntries: [
      { lineOriginId: 'supports', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'irrelevant', against: 'claim', mark: 'not_applicable' },
    ],
    adversarialStatus: 'survived',
  }),
  expected: { band: 'contested', qualifier: 'insufficient_evidence', tree: 'tree1_simple_factual' },
};
