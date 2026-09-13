# Phase 1 Data Model: Judgment Pipeline MVP

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Types reuse `001-rule-engine-core`'s exported shapes (`WarrantGrade`, `ReliabilityGrade`,
`DiagnosticMark`, `AdversarialStatus`, `FiredTrigger`, `Rival`, `Origin`, `Warrant`,
`DiagnosticityEntry`, `LedgerInput`) wherever the pipeline's job is to eventually produce one of
them — this feature adapts to that schema, per Constitution Principle IV, rather than declaring a
parallel one.

## LlmClient

```ts
interface LlmClient {
  readonly modelId: string;
  generate(prompt: string): Promise<{ text: string }>;
  generateWithSearch(prompt: string): Promise<{ text: string; groundingUrls: string[] }>;
}
```

One real implementation (`GeminiLlmClient`, wrapping `@google/genai` with the caller's key) and
one test-only implementation (`MockLlmClient`, returning scripted responses) share this interface.
Every other module in `src-pipeline/` depends only on this interface, never on `@google/genai`
directly — this is what makes the whole orchestration testable without a real key or network
access (research.md's testing note).

## Harm gate

```ts
type HarmGateResult =
  | { outcome: 'accept' }
  | { outcome: 'reject'; rule: string }
  | { outcome: 'needs_review'; reason: string };
```

`rule` and `reason` are both required to be specific (FR-005, SC-002, SC-008) — never a generic
message. `harm-gate.ts` writes a `ReviewQueueEntry` (below) as a side effect exactly when the
outcome is `needs_review`; `reject` and `accept` write nothing.

## ReviewQueueEntry (persisted — research.md §4)

```ts
interface ReviewQueueEntry {
  runId: string;
  claimText: string;
  reason: string;
  queuedAt: string; // ISO 8601
}
```

Appended as one JSON line to `runs/review-queue.jsonl`. Read back by future tooling this feature
does not itself build (PROJECT-TRACKER.md).

## Candidate Origin, Fetch Record, Retrieved Origin

```ts
interface CandidateOrigin {
  url: string;
  title: string;
  foundVia: string; // the search query that surfaced it
}

interface FetchRecord {
  requestedUrl: string;
  finalUrl: string | null; // null only if the request itself failed outright
  succeeded: boolean;
  httpStatus: number | null;
  contentHash: string | null; // sha256 of the raw response body; null iff !succeeded
  fetchedAt: string; // ISO 8601
}

interface RetrievedOrigin {
  id: string; // stable within this run
  candidate: CandidateOrigin;
  fetch: FetchRecord;
  content: string | null; // raw text; null iff fetch failed or was a paywall snippet-only case (FR-014's could_not_retrieve)
  registryClass: RegistryClass | null; // null = not matched in the registry (treated as an original source)
}
```

A `RetrievedOrigin` with `content === null` maps to `001`'s `Origin` with
`retrievalStatus: 'could_not_retrieve'` (FR-014) — this covers both an outright fetch failure and
the clarified paywall/snippet-only case, per the accepted clarification on FR-014.

## Registry (seed, static, versioned — FR-037–FR-039)

```ts
type RegistryClass = 'aggregator' | 'press_release' | 'preprint' | 'paywalled';

interface RegistryEntry {
  domain: string;
  class: RegistryClass;
  note: string; // why classified this way — reviewable, not a per-run guess
}
```

Ships as a static `RegistryEntry[]` constant in `registry.ts` (spec.md Assumptions: a small seed
set, not a comprehensive system, for this MVP).

## Grading rubric and output (User Story 4)

```ts
/** The fixed D1-D4/upgrade/interested-party question set every grading call answers — the rubric
 *  itself, not pre-computed answers (research.md §6). */
interface GradingRubric {
  readonly text: string;
}

interface GradingOutput {
  startingGrade: WarrantGrade; // from 001
  firedTriggers: FiredTrigger[]; // from 001 — each MUST carry a mechanism (FR-021)
  interestedParty: boolean;
  partyControlledCreationAfterStakesVisible: boolean;
  sourceReliabilityGrade: ReliabilityGrade; // from 001
  rawModelReasoning: string; // archived for audit, never shown to a later step as if it were fact
}
```

`gradeOrigin(origin: RetrievedOrigin, llm: LlmClient, rubric: GradingRubric): Promise<GradingOutput>`
— no claim parameter exists in this signature (research.md §6). `run-pipeline.ts` is the only
module that ever holds both a claim and a `GradingOutput` at the same time.

**Naming mismatch found during implementation**: the protocol's own reliability vocabulary
(Strong/Mixed/Unknown/Poor/Fabricator) doesn't match `001`'s `ReliabilityGrade` enum values
(`reliable`/`mixed`/`not_rated`/`poor`/`fabricator`) verbatim — `grade.ts`'s `mapReliabilityGrade`
translates between them so the grading rubric can stay faithful to the protocol's own wording
while still producing a value `001`'s schema accepts.

## Diagnosticity and rivals (User Stories 5–6)

```ts
interface DiagnosticityOutput {
  markAgainstClaim: DiagnosticMark; // from 001
  marksAgainstRivals: Record<string /* rivalId */, DiagnosticMark>;
}

interface RivalHypothesis {
  id: string;
  description: string;
  plausibilityRelativeToClaim: Rival['plausibilityRelativeToClaim']; // from 001
}
```

Unlike `gradeOrigin`, `markDiagnosticity(origin: RetrievedOrigin, claim: string, rivals:
RivalHypothesis[], llm: LlmClient): Promise<DiagnosticityOutput>` **does** take the claim — FR-027
explicitly permits this, since this judgment is inherently about the origin/claim relationship.

## Adversarial testing (User Story 7)

```ts
interface AdversarialOutput {
  status: AdversarialStatus; // 'survived' | 'untested', from 001
  revisionOccurred: boolean;
}
```

## Run trace and final result

```ts
interface RunTrace {
  runId: string;
  requester: string | null; // caller-supplied label; no auth system exists yet (spec.md Assumptions) so this is a free-text attribution, not a verified identity
  modelIds: string[];
  startedAt: string;
  completedAt: string;
  steps: { step: string; modelId: string; timestamp: string }[];
}

type PipelineResult =
  | { kind: 'rejected'; rule: string }
  | { kind: 'needs_review'; reason: string; queuedAt: string }
  | { kind: 'completed'; ledger: LedgerInput; trace: RunTrace }
  | { kind: 'auth_failed'; message: string };
```

`auth_failed` was added during implementation — FR-010 requires an authorization failure be
distinguished from every other failure category, and the original 3-variant union had no distinct
case for it (an invalid key would otherwise have had to masquerade as one of the other three,
which is exactly what FR-010 rules out).

`kind: 'completed'`'s `ledger` is validated with the same Zod schema `001`'s own `evaluate()` uses
internally, before `run-pipeline.ts` ever returns it (FR-033, SC-004) — a `PipelineResult` never
carries a ledger that would make `001`'s engine refuse it.

## State flow

```text
claim text, apiKey
  -> harm-gate.ts -> HarmGateResult
       'reject'       -> PipelineResult { kind: 'rejected' }                    [STOP]
       'needs_review'  -> write ReviewQueueEntry -> PipelineResult { kind: 'needs_review' } [STOP]
       'accept'         -> continue
  -> search.ts (LlmClient.generateWithSearch) -> CandidateOrigin[]
  -> retrieve.ts (plain fetch, per candidate) -> RetrievedOrigin[]
  -> registry.ts (per RetrievedOrigin)         -> registryClass filled in
  -> grade.ts (per RetrievedOrigin, claim-blind) -> GradingOutput[]
  -> rivals.ts (LlmClient.generate)              -> RivalHypothesis[]
  -> diagnosticity.ts (per RetrievedOrigin, claim + rivals visible) -> DiagnosticityOutput[]
  -> adversarial.ts                                -> AdversarialOutput
  -> assemble-ledger.ts                              -> LedgerInput (zod-validated)
  -> PipelineResult { kind: 'completed', ledger, trace }
```

Every arrow after the harm gate is sequential (each step's output feeds the next), matching
`run-pipeline.ts`'s role as the single place that holds the claim, the ledger-in-progress, and the
`LlmClient` all at once — no other module needs all three.
