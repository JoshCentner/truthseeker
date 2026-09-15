import { evaluate } from '../../../src/index.js';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Demonstrates WHY run-pipeline.ts skips the evidence steps for causal,
 * predictive and complex-system claims: their band cannot depend on evidence,
 * because evaluateTree2/3/4 each receive only the treeExtension and never touch
 * the normalized ledger. This is a standing MVP limitation, not a resolved bug
 * — it stays fixed only when real Tree 2/3/4 depth lands. Keep this probe until
 * then, so the claim "the band is a constant" is checkable rather than asserted.
 */
const dir = 'corpus/runs';
const file = fs.readdirSync(dir).find((f) => f.startsWith('vaccines-autism'));
if (!file) {
  console.error(`no vaccines-autism record under ${dir}/ — run tools/manual-run/run.mts first`);
  process.exit(1);
}
const rec = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
const ledger = rec.result.ledger;

console.log('record:', file);
console.log('as produced            ->', evaluate(ledger).band);

// Give it a full, maximally favourable evidence base it never had.
const origin = (id: string) => ({ id, retrievalStatus: 'retrieved' as const, retracted: false, correctedFormOfId: null });
const warrant = (originId: string) => ({
  originId,
  startingGrade: 'physical_documentary' as const,
  firedTriggers: [],
  interestedParty: false,
  partyControlledCreationAfterStakesVisible: false,
  sourceReliabilityGrade: 'reliable' as const,
  channelKeys: { data: null, method: null, institution: null, motive: null },
});
const stacked = {
  ...ledger,
  origins: [origin('a'), origin('b')],
  warrants: [warrant('a'), warrant('b')],
  diagnosticityEntries: [
    { lineOriginId: 'a', against: 'claim', mark: 'consistent' },
    { lineOriginId: 'b', against: 'claim', mark: 'consistent' },
  ],
  rivals: [],
  adversarialStatus: 'survived',
  extraordinaryClusterSurvivedAdversarialTesting: true,
};
console.log('evidence stacked FOR it ->', evaluate(stacked as never).band);
console.log('different causal claim ->', evaluate({ ...ledger, claimRestatement: 'Smoking causes lung cancer.' } as never).band);
console.log('\nAll identical: the causal band ignores evidence entirely, which is why');
console.log('run-pipeline.ts no longer pays to gather any for a non-simple-factual claim.');
