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
}
