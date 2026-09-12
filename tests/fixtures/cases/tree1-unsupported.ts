import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-unsupported',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Unsupported (nothing survives — a burden finding, not Contested/Refuted)',
  input: baseLedger({
    origins: [makeOrigin('o1')],
    warrants: [makeWarrant('o1', { startingGrade: 'assertion' })],
  }),
  expected: { band: 'unsupported', tree: 'tree1_simple_factual' },
};
