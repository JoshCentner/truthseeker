import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

// Three independent (unlinked) clusters supporting one claim. FR-041: this
// goes through Tree 1's own cluster counting, never through aggregate()'s
// minimum-of-load-bearing rule — there is no sub-claim structure here at all,
// only converging evidence on a single claim.
export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-multi-cluster-not-aggregated',
  protocolClause: 'AGENT-PROTOCOL-v3.md aggregation, FR-041 (converging clusters on one claim are not sub-claims; aggregation rules do not apply)',
  input: baseLedger({
    origins: [makeOrigin('o1'), makeOrigin('o2'), makeOrigin('o3')],
    warrants: [makeWarrant('o1'), makeWarrant('o2'), makeWarrant('o3')],
    diagnosticityEntries: [
      { lineOriginId: 'o1', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'o2', against: 'claim', mark: 'consistent' },
      { lineOriginId: 'o3', against: 'claim', mark: 'consistent' },
    ],
    adversarialStatus: 'survived',
    silenceFinding: 'none',
  }),
  expected: { band: 'established', tree: 'tree1_simple_factual' },
};
