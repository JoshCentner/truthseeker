import { evaluate, ENGINE_VERSION } from '../src/index.js';
import type { LedgerInput, Verdict } from '../src/index.js';
import { findBlockedOrigins } from '../src-pipeline/source-policy.js';

/**
 * Loading and interpreting stored run records.
 *
 * The central decision here is FR-031/FR-032 (research.md §4): the band a page
 * displays is the band the RECORD carries, not the band today's engine would
 * compute. Both are real, and they genuinely disagree — bumping the engine to
 * 0.2.0 on 2026-09-15 moved a stored record from Contested to Refuted off an
 * unchanged ledger. Displaying the recomputed band would make the page
 * contradict the record it cites and would destroy the reproducibility that
 * stamping engine_version on every run exists to provide. Displaying only the
 * recorded band would let a page show a verdict the current methodology has
 * abandoned, indefinitely and invisibly. So: show the record's band, and show
 * the disagreement.
 */

export type RunKind = 'completed' | 'rejected' | 'needs_review' | 'needs_clarification';

export interface StoredRun {
  runId: string;
  kind: RunKind;
  file: string;
  /** Present only for completed runs. */
  ledger?: LedgerInput;
  trace?: {
    runId: string;
    requester: string | null;
    modelIds: string[];
    startedAt: string;
    completedAt: string;
    steps: { step: string; modelId: string; timestamp: string }[];
    remediationAttempts: { step: string; attemptNumber: number; violation: string | null; succeeded: boolean }[];
    /** Sources the deterministic registry gate refused before they could become
     * origins. Absent on records written before the gate existed. */
    excludedSources?: { url: string; registryClass: string | null; reason: string }[];
  };
  recordedVerdict?: Verdict;
  provenance?: Record<string, unknown>;
  claimText?: string;
  /** Present only for runs that ended without a verdict (FR-013a). */
  outcome?: { summary: string; detail: string[] };
  recordedAt: string;
}

export class RunRecordError extends Error {
  constructor(message: string, readonly file: string) {
    super(`${file}: ${message}`);
  }
}

export type Drift = 'none' | 'superseded' | 'uncheckable';

export interface DisplayedVerdict {
  recordedBand: string;
  recordedQualifier: string | null;
  recordedEngineVersion: string;
  recordedSchemaVersion: string;
  currentBand: string | null;
  currentEngineVersion: string;
  drift: Drift;
  /** Populated when drift is 'uncheckable', explaining why. */
  uncheckableReason?: string;
}

interface RawRecord {
  claim?: string;
  result?: { kind?: string; ledger?: LedgerInput; trace?: StoredRun['trace']; rule?: string; reason?: string; step?: string; questions?: string[] };
  verdict?: Verdict;
  provenance?: Record<string, unknown> & { recordedAt?: string };
}

/**
 * Turns one stored JSON record into a StoredRun. FR-009b: an auth_failed record
 * is refused outright rather than rendered — it is a fact about whoever held the
 * key, carries no finding about the claim, and publishing it would expose
 * operational detail for no auditing benefit.
 */
export function parseRunRecord(json: unknown, file: string): StoredRun {
  if (typeof json !== 'object' || json === null) {
    throw new RunRecordError('run record is not a JSON object', file);
  }
  const raw = json as RawRecord;
  const kind = raw.result?.kind;

  if (kind === 'auth_failed') {
    throw new RunRecordError(
      'auth_failed runs must not be stored in the corpus (FR-009b). The run failed because the operator\'s ' +
        'credentials were rejected, which says nothing about the claim and exposes operational detail.',
      file,
    );
  }
  if (kind !== 'completed' && kind !== 'rejected' && kind !== 'needs_review' && kind !== 'needs_clarification') {
    throw new RunRecordError(`unrecognised result.kind ${JSON.stringify(kind)}`, file);
  }

  const recordedAt = String(raw.provenance?.recordedAt ?? raw.result?.trace?.completedAt ?? '');

  if (kind === 'completed') {
    if (!raw.result?.ledger || !raw.verdict || !raw.result.trace) {
      throw new RunRecordError('a completed run must carry result.ledger, result.trace and verdict', file);
    }
    return {
      runId: raw.result.trace.runId,
      kind,
      file,
      ledger: raw.result.ledger,
      trace: raw.result.trace,
      recordedVerdict: raw.verdict,
      provenance: raw.provenance,
      claimText: raw.result.ledger.claimRestatement,
      recordedAt,
    };
  }

  // FR-013a: a run without a verdict carries its outcome and the reason for it.
  const detail: string[] = [];
  let summary: string;
  if (kind === 'rejected') {
    summary = 'Rejected at intake by the harm gate before any evidence was gathered.';
    detail.push(`Rule that fired: ${raw.result?.rule ?? '(not recorded)'}`);
  } else if (kind === 'needs_review') {
    summary = 'Held for human review at intake. Neither accepted nor rejected automatically.';
    detail.push(`Reason queued: ${raw.result?.reason ?? '(not recorded)'}`);
  } else {
    summary = 'Stopped before a verdict: a step exhausted its remediation budget.';
    detail.push(`Step: ${raw.result?.step ?? '(not recorded)'}`);
    for (const q of raw.result?.questions ?? []) detail.push(`Outstanding question: ${q}`);
  }

  return {
    runId: String((raw.provenance?.runId as string | undefined) ?? file),
    kind,
    file,
    provenance: raw.provenance,
    claimText: raw.claim,
    outcome: { summary, detail },
    recordedAt,
  };
}

/** FR-031/032/033: recorded band leads, current engine is the drift check. */
export function displayedVerdict(run: StoredRun): DisplayedVerdict | null {
  if (run.kind !== 'completed' || !run.recordedVerdict || !run.ledger) return null;
  const recorded = run.recordedVerdict;

  let currentBand: string | null = null;
  let drift: Drift = 'none';
  let uncheckableReason: string | undefined;

  try {
    const recomputed = evaluate(run.ledger);
    if (recomputed.refusalReason) {
      drift = 'uncheckable';
      uncheckableReason = `the current engine refuses this ledger: ${recomputed.refusalReason}`;
    } else {
      currentBand = recomputed.band;
      drift = recomputed.band === recorded.band ? 'none' : 'superseded';
    }
  } catch (err) {
    drift = 'uncheckable';
    uncheckableReason = `the current engine could not read this ledger: ${err instanceof Error ? err.message : String(err)}`;
  }

  return {
    recordedBand: recorded.band ?? 'unknown',
    recordedQualifier: recorded.qualifier ?? null,
    recordedEngineVersion: recorded.engineVersion,
    recordedSchemaVersion: recorded.schemaVersion,
    currentBand,
    currentEngineVersion: ENGINE_VERSION,
    drift,
    uncheckableReason,
  };
}

/**
 * Re-checks a stored record's origins against the current source registry.
 *
 * Reports rather than refuses, deliberately. The registry is curated and grows:
 * a domain added today would retroactively invalidate records committed in good
 * faith under yesterday's rules. Refusing to render them would delete history to
 * tidy up a rule change. Instead the record stays readable and the page says
 * plainly that a source in it would not be accepted today — which is the honest
 * statement of both facts, and is the same treatment engine drift gets.
 */
export function blockedOriginsIn(run: StoredRun): { url: string; reason: string }[] {
  if (!run.ledger) return [];
  return findBlockedOrigins(run.ledger.origins.map((o) => o.id)).map((s) => ({
    url: s.url,
    reason: s.reason ?? 'blocked by the structural source registry',
  }));
}

/**
 * FR-029b: two runs share an evidence base when their ledgers reference the same
 * origins with the same retrieval statuses and retraction flags.
 *
 * Known limitation, carried from the spec's Assumptions: content hashes live in
 * the fetch archive rather than in the record, so a source that silently changed
 * its content at the same URL reads here as an unchanged evidence base. Closing
 * that means carrying the hash into the record, which is a schema change.
 */
export function evidenceFingerprint(run: StoredRun): string {
  if (!run.ledger) return '';
  return run.ledger.origins
    .map((o) => `${o.id}|${o.retrievalStatus}|${o.retracted ? 'retracted' : 'live'}`)
    .sort()
    .join('\n');
}
