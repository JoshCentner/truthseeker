import type {
  WarrantGrade,
  ReliabilityGrade,
  DiagnosticMark,
  AdversarialStatus,
  FiredTrigger,
  Rival,
  LedgerInput,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Harm gate (FR-001-002a)
// ---------------------------------------------------------------------------

export type HarmGateResult =
  | { outcome: 'accept' }
  | { outcome: 'reject'; rule: string }
  | { outcome: 'needs_review'; reason: string };

export interface ReviewQueueEntry {
  runId: string;
  claimText: string;
  reason: string;
  queuedAt: string;
}

// ---------------------------------------------------------------------------
// Source discovery and retrieval (FR-011-016, FR-037-039)
// ---------------------------------------------------------------------------

export interface CandidateOrigin {
  url: string;
  title: string;
  foundVia: string;
}

export interface FetchRecord {
  requestedUrl: string;
  finalUrl: string | null;
  succeeded: boolean;
  httpStatus: number | null;
  contentHash: string | null;
  fetchedAt: string;
}

export type RegistryClass = 'aggregator' | 'press_release' | 'preprint' | 'paywalled';

export interface RegistryEntry {
  domain: string;
  class: RegistryClass;
  note: string;
}

export interface RetrievedOrigin {
  id: string;
  candidate: CandidateOrigin;
  fetch: FetchRecord;
  content: string | null;
  registryClass: RegistryClass | null;
}

// ---------------------------------------------------------------------------
// Grading (FR-020-025)
// ---------------------------------------------------------------------------

export interface GradingRubric {
  readonly text: string;
}

export interface GradingOutput {
  startingGrade: WarrantGrade;
  firedTriggers: FiredTrigger[];
  interestedParty: boolean;
  partyControlledCreationAfterStakesVisible: boolean;
  sourceReliabilityGrade: ReliabilityGrade;
  rawModelReasoning: string;
}

// ---------------------------------------------------------------------------
// Diagnosticity and rivals (FR-026-030)
// ---------------------------------------------------------------------------

export interface DiagnosticityOutput {
  markAgainstClaim: DiagnosticMark;
  marksAgainstRivals: Record<string, DiagnosticMark>;
}

export interface RivalHypothesis {
  id: string;
  description: string;
  plausibilityRelativeToClaim: Rival['plausibilityRelativeToClaim'];
}

// ---------------------------------------------------------------------------
// Adversarial testing (FR-031-032)
// ---------------------------------------------------------------------------

export interface AdversarialOutput {
  status: AdversarialStatus;
  revisionOccurred: boolean;
  /**
   * Whether the adversarial step actually ran a test, as distinct from what
   * the test concluded. The two came apart in practice: `status` is set to
   * 'untested' both when no testable lead evidence existed AND when the test
   * ran and found a genuine weakness, so deriving "was a steelman performed"
   * from `status` produced ledgers reading { performed: false,
   * revisionOccurred: true } — "it never happened, and it changed something".
   */
  performed: boolean;
}

// ---------------------------------------------------------------------------
// Run trace and final result (FR-033-036)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Bounded remediation (FR-040-045 — amendment)
// ---------------------------------------------------------------------------

export interface RemediationAttempt {
  step: string;
  attemptNumber: number;
  violation: string | null;
  succeeded: boolean;
}

// ---------------------------------------------------------------------------
// Run trace and final result (FR-033-036)
// ---------------------------------------------------------------------------

export interface RunTrace {
  runId: string;
  requester: string | null;
  modelIds: string[];
  startedAt: string;
  completedAt: string;
  steps: { step: string; modelId: string; timestamp: string }[];
  remediationAttempts: RemediationAttempt[];
}

export type PipelineResult =
  | { kind: 'rejected'; rule: string }
  | { kind: 'needs_review'; reason: string; queuedAt: string }
  | { kind: 'completed'; ledger: LedgerInput; trace: RunTrace }
  | { kind: 'auth_failed'; message: string }
  | { kind: 'needs_clarification'; step: string; questions: string[] };

export interface RunOptions {
  requester?: string;
  modelId?: string;
  /** 004 (claim-dashboard) amendment: additive and optional — no existing
   * caller is affected. Called immediately after each step is recorded in
   * the trace, so a caller can surface live progress during a real,
   * multi-minute run. */
  onProgress?: (step: string) => void;
}
