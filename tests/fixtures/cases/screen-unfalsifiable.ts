import { baseLedger, type FixtureCase } from '../helpers.js';

export const case_: FixtureCase = {
  kind: 'evaluate',
  id: 'screen-unfalsifiable',
  protocolClause: 'AGENT-PROTOCOL-v3.md Step 1, FR-033 (falsifiability screen fires — structural verdict, no tree runs)',
  input: baseLedger({
    screens: { falsifiability: 'fired', priorPlausibility: 'ordinary' },
  }),
  expected: { band: 'unfalsifiable', tree: 'screen' },
};
