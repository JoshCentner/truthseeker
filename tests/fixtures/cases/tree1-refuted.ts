import { baseLedger, makeOrigin, makeWarrant, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'tree1-refuted',
  protocolClause: 'AGENT-PROTOCOL-v3.md Tree 1, Refuted (load-bearing origin retracted — a falsity finding)',
  input: baseLedger({
    origins: [makeOrigin('o1', { retracted: true })],
    warrants: [makeWarrant('o1')],
  }),
  expected: { band: 'refuted', tree: 'tree1_simple_factual' },
};
