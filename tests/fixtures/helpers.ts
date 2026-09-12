import type { LedgerInput, CompoundInput, CompoundSubClaim, Origin, Warrant, Band, Qualifier, TreeId } from '../../src/schema/ledger.js';

export function makeOrigin(id: string, overrides: Partial<Origin> = {}): Origin {
  return { id, retrievalStatus: 'retrieved', retracted: false, correctedFormOfId: null, ...overrides };
}

export function makeWarrant(originId: string, overrides: Partial<Warrant> = {}): Warrant {
  return {
    originId,
    startingGrade: 'contemporaneous_record',
    firedTriggers: [],
    interestedParty: false,
    partyControlledCreationAfterStakesVisible: false,
    sourceReliabilityGrade: 'reliable',
    channelKeys: { data: null, method: null, institution: null, motive: null },
    ...overrides,
  };
}

export function baseLedger(overrides: Partial<LedgerInput> = {}): LedgerInput {
  return {
    schemaVersion: '0.1.0',
    claimRestatement: 'Test claim',
    classification: { primary: 'simple_factual', confidence: 'high' },
    screens: { falsifiability: 'pass', priorPlausibility: 'ordinary' },
    origins: [],
    warrants: [],
    rivals: [],
    diagnosticityEntries: [],
    adversarialStatus: 'survived',
    silenceFinding: 'none',
    steelman: { performed: false, revisionOccurred: false },
    extraordinaryClusterSurvivedAdversarialTesting: null,
    treeExtension: null,
    ...overrides,
  };
}

interface ExpectedVerdict {
  /** null only for Tree 4's decomposable branch — see src/trees/types.ts. */
  band: Band | null;
  qualifier?: Qualifier;
  tree: TreeId;
  movedBy?: string | null;
}

export interface EvaluateFixtureCase {
  kind: 'evaluate';
  id: string;
  protocolClause: string;
  input: LedgerInput;
  expected: ExpectedVerdict;
}

export interface AggregateFixtureCase {
  kind: 'aggregate';
  id: string;
  protocolClause: string;
  input: CompoundInput;
  previous?: { subClaims: CompoundSubClaim[] };
  expected: ExpectedVerdict;
}

export type FixtureCase = EvaluateFixtureCase | AggregateFixtureCase;
