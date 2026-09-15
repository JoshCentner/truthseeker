import { evaluate, SCHEMA_VERSION } from '../../../src/index.js';
const origin = (id: string) => ({ id, retrievalStatus: 'retrieved' as const, retracted: false, correctedFormOfId: null });
const warrant = (originId: string) => ({
  originId, startingGrade: 'physical_documentary' as const, firedTriggers: [],
  interestedParty: false, partyControlledCreationAfterStakesVisible: false,
  sourceReliabilityGrade: 'reliable' as const,
  channelKeys: { data: null, method: null, institution: null, motive: null },
});
const ledger = {
  schemaVersion: SCHEMA_VERSION,
  claimRestatement: 'The Earth is flat.',
  classification: { primary: 'simple_factual' as const, confidence: 'high' as const },
  screens: { falsifiability: 'pass' as const, priorPlausibility: 'ordinary' as const },
  origins: [origin('https://a.example/one'), origin('https://b.example/two')],
  warrants: [warrant('https://a.example/one'), warrant('https://b.example/two')],
  rivals: [],
  // BOTH lines flatly CONTRADICT the claim.
  diagnosticityEntries: [
    { lineOriginId: 'https://a.example/one', against: 'claim' as const, mark: 'inconsistent' as const },
    { lineOriginId: 'https://b.example/two', against: 'claim' as const, mark: 'inconsistent' as const },
  ],
  adversarialStatus: 'survived' as const,
  silenceFinding: 'none' as const,
  steelman: { performed: true, revisionOccurred: false },
  extraordinaryClusterSurvivedAdversarialTesting: null,
  treeExtension: null,
};
const v = evaluate(ledger as never);
console.log('claim:', ledger.claimRestatement);
console.log('every surviving line marked INCONSISTENT with the claim; no rivals.');
console.log('band     ->', v.band, v.qualifier ?? '');
console.log('tree     ->', v.tree);
console.log('met      ->', JSON.stringify(v.conditionsMet));
console.log('capping  ->', JSON.stringify(v.cappingConditions));
