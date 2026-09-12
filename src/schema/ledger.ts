/**
 * Core typed schema for the GroundTruth rule engine.
 *
 * LedgerInput and Verdict are deliberately disjoint interfaces (research.md §3):
 * no field appears in both, so a caller cannot pre-populate a computed field by
 * accident, and the engine never needs to read a computed field as if it were
 * input. See FR-003.
 */

// ---------------------------------------------------------------------------
// Shared enums (data-model.md "Shared enums")
// ---------------------------------------------------------------------------

export type WarrantGrade =
  | 'assertion'
  | 'testimony'
  | 'contemporaneous_record'
  | 'physical_documentary';

/** Ordered weakest-to-strongest. Used to compare grades without inventing a numeric score. */
export const WARRANT_GRADE_ORDER: readonly WarrantGrade[] = [
  'assertion',
  'testimony',
  'contemporaneous_record',
  'physical_documentary',
];

export type ReliabilityGrade = 'fabricator' | 'poor' | 'mixed' | 'reliable' | 'not_rated';

export type ContaminationChannel = 'data' | 'method' | 'institution' | 'motive';

export type DiagnosticMark = 'consistent' | 'inconsistent' | 'not_applicable';

export type AdversarialStatus = 'survived' | 'untested';

export type ClaimType = 'simple_factual' | 'causal' | 'predictive' | 'complex_system';

export type Band =
  | 'established'
  | 'probable'
  | 'contested'
  | 'doubtful'
  | 'unsupported'
  | 'refuted'
  | 'unresolvable'
  | 'unfalsifiable';

export type Qualifier = 'insufficient_evidence' | 'conflicting_evidence';

export type TreeId =
  | 'tree1_simple_factual'
  | 'tree2_causal'
  | 'tree3_predictive'
  | 'tree4_complex_system'
  | 'aggregation'
  | 'screen';

// ---------------------------------------------------------------------------
// Origin / Warrant / Evidence Line / Cluster / Rival (data-model.md)
// ---------------------------------------------------------------------------

export interface Origin {
  id: string;
  retrievalStatus: 'retrieved' | 'could_not_retrieve';
  retracted: boolean;
  correctedFormOfId: string | null;
}

export interface FiredTrigger {
  direction: 'upgrade' | 'downgrade';
  /** MUST be non-empty; the engine rejects any trigger without one (FR-012). */
  mechanism: string;
}

export interface Warrant {
  originId: string;
  startingGrade: WarrantGrade;
  firedTriggers: FiredTrigger[];
  interestedParty: boolean;
  /** Only meaningful when startingGrade === 'contemporaneous_record' && interestedParty. */
  partyControlledCreationAfterStakesVisible: boolean;
  sourceReliabilityGrade: ReliabilityGrade;
  /**
   * Identifiers used to detect shared contamination channels (FR-016). Two
   * lines share a channel when both carry the same non-null key for it. Not
   * called out as a separate field in data-model.md's prose table, but
   * required to make clustering computable — added here during
   * implementation; data-model.md is updated to match.
   */
  channelKeys: {
    data: string | null;
    method: string | null;
    institution: string | null;
    motive: string | null;
  };
}

/** Warrant plus its engine-computed final grade. Internal to normalization. */
export interface GradedWarrant extends Warrant {
  finalGrade: WarrantGrade;
}

export interface EvidenceLine {
  originId: string;
  finalGrade: WarrantGrade;
  survives: boolean;
  diagnosticity: {
    claim: DiagnosticMark;
    rivals: Record<string, DiagnosticMark>;
  };
  nonDiagnostic: boolean;
  clusterId: string | null;
}

export interface Cluster {
  id: string;
  memberLineIds: string[];
  sharedChannels: ContaminationChannel[];
  grade: WarrantGrade;
}

export interface Rival {
  id: string;
  description: string;
  rebutted: boolean;
  plausibilityRelativeToClaim: 'more_plausible' | 'less_or_equally_plausible';
}

export interface DiagnosticityEntry {
  lineOriginId: string;
  against: 'claim' | { rivalId: string };
  mark: DiagnosticMark;
}

// ---------------------------------------------------------------------------
// Per-tree extension blocks (data-model.md)
// ---------------------------------------------------------------------------

export interface Tree2Extension {
  underlyingFactualBand: Band;
  temporalityFinding: 'established' | 'absent';
  discriminatingCriterionMet: boolean;
  supportiveCriteriaCount: number;
}

export interface Tree3Extension {
  meetsEstablishedShapedConditions: boolean;
}

export type Tree4Extension =
  | { decomposable: true; subClaimIds: string[] }
  | { decomposable: false; whyNoHonestBand: string; evidenceThatWouldChangeIt: string };

// ---------------------------------------------------------------------------
// LedgerInput — everything a caller supplies for a single-claim evaluation
// ---------------------------------------------------------------------------

export interface LedgerInput {
  schemaVersion: string;
  claimRestatement: string;
  classification: {
    primary: ClaimType;
    confidence: 'high' | 'low';
    alternative?: ClaimType;
  };
  screens: {
    falsifiability: 'pass' | 'fired';
    priorPlausibility: 'ordinary' | 'extraordinary';
  };
  origins: Origin[];
  warrants: Warrant[];
  rivals: Rival[];
  diagnosticityEntries: DiagnosticityEntry[];
  adversarialStatus: AdversarialStatus;
  silenceFinding: 'none' | 'weak' | 'strong';
  steelman: { performed: boolean; revisionOccurred: boolean };
  /** null unless screens.priorPlausibility === 'extraordinary' (FR-031). */
  extraordinaryClusterSurvivedAdversarialTesting: boolean | null;
  treeExtension: Tree2Extension | Tree3Extension | Tree4Extension | null;
}

// ---------------------------------------------------------------------------
// CompoundInput — separate entry point for aggregation (User Story 5)
// ---------------------------------------------------------------------------

export interface CompoundSubClaim {
  id: string;
  band: Band;
  edgeType: 'load_bearing' | 'supplementary';
}

export interface CompoundInput {
  subClaims: CompoundSubClaim[];
  /** Used only for cycle detection (FR-040). */
  edges: { from: string; to: string }[];
}

// ---------------------------------------------------------------------------
// Verdict — the engine's sole output shape
// ---------------------------------------------------------------------------

export interface ConditionRef {
  id: string;
  protocolClause: string;
}

export interface Verdict {
  band: Band | null;
  qualifier: Qualifier | null;
  tree: TreeId | null;
  conditionsMet: ConditionRef[];
  cappingConditions: ConditionRef[];
  engineVersion: string;
  schemaVersion: string;
  dependenceMap: { clusterId: string; channels: ContaminationChannel[]; memberLineIds: string[] }[] | null;
  residue: string | null;
  movedBy: string | null;
  /** Non-null iff the engine refused to emit a band (FR-008). */
  refusalReason: string | null;
}
