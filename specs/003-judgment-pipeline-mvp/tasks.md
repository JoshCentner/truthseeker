---

description: "Task list template for feature implementation"

---

# Tasks: Judgment Pipeline MVP

**Input**: Design documents from `/specs/003-judgment-pipeline-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pipeline-api.md,
quickstart.md (all present)

**Tests**: Not separately requested. Every test in this feature runs against `MockLlmClient` —
none require a real API key or network access; live validation is a human's job per
quickstart.md Part 2, not an automated task.

**Organization**: Tasks are grouped by user story (spec.md priorities P1×5/P2/P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Which user story this task belongs to (US1–US7)
- File paths follow plan.md's Project Structure (`src-pipeline/` and `src-pipeline/tests/`)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Add `@google/genai` (pinned `<3.0.0` per research.md §1) as a dependency and `tsx` as a devDependency for running the CLI directly
- [x] T002 [P] Create `src-pipeline/` and `src-pipeline/tests/` directories
- [x] T003 [P] Add `runs/` to `.gitignore` — fetch archives and the review queue may contain fetched third-party content and must stay local-only
- [x] T004 [P] Add `.env.example` documenting `GEMINI_API_KEY` (a placeholder, never a real key), matching contracts/pipeline-api.md's key-handling convention

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Define the `LlmClient` interface in `src-pipeline/llm-client.ts` per data-model.md
- [x] T006 Implement `MockLlmClient` in `src-pipeline/llm-client.ts`: a scriptable, queue-based fake implementing `LlmClient`, exported (not test-only) so every later test can reuse it (depends on T005)
- [x] T007 Implement `GeminiLlmClient` in `src-pipeline/llm-client.ts`: wraps `@google/genai`, `generateWithSearch` passes `tools: [{ google_search: {} }]` (research.md §2), constructor takes the caller's key and never logs it (depends on T005)
- [x] T008 [P] Define every shared type from data-model.md (`HarmGateResult`, `ReviewQueueEntry`, `CandidateOrigin`, `FetchRecord`, `RetrievedOrigin`, `RegistryClass`, `RegistryEntry`, `GradingRubric`, `GradingOutput`, `DiagnosticityOutput`, `RivalHypothesis`, `AdversarialOutput`, `RunTrace`, `PipelineResult`, `RunOptions`) in `src-pipeline/types.ts`
- [x] T009 [P] Implement `appendJsonLine(path, record)` in `src-pipeline/storage.ts` (research.md §4), used by both the review queue and the fetch archive
- [x] T010 Create `src-pipeline/run-pipeline.ts` with the orchestration skeleton from data-model.md's State flow, every step stubbed to be filled in by later phases (depends on T008)
- [x] T011 Create `src-pipeline/index.ts`'s `runPipeline(claim, apiKey, options)` per contracts/pipeline-api.md: constructs a `GeminiLlmClient` and calls the orchestration (depends on T007, T010)
- [x] T012 Create `src-pipeline/cli.ts` per contracts/pipeline-api.md: claim from `argv`, key from `GEMINI_API_KEY` or `--key-stdin` — never a `--key` flag (research.md §5); prints `PipelineResult` as JSON; exit code varies by result kind (depends on T011)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Reject out-of-scope claims before any spend (Priority: P1) 🎯 MVP

**Goal**: The harm gate runs first, every time, with a three-way outcome (accept/reject/needs-
review), and nothing downstream ever runs for the latter two.

**Independent Test**: spec.md's 6 acceptance scenarios for User Story 1.

### Implementation for User Story 1

- [x] T013 [P] [US1] Implement the pre-flight classifier prompt and call in `src-pipeline/harm-gate.ts` (FR-001) (depends on T005)
- [x] T014 [US1] Implement the 3-way outcome parsing (accept/reject/needs_review) from the classifier's response in `harm-gate.ts` (FR-002, FR-003, FR-004) (depends on T013)
- [x] T015 [US1] Implement rejection-rule naming in `harm-gate.ts`: every `reject` result carries a specific rule string, never a generic message (FR-005) (depends on T014)
- [x] T016 [US1] Implement `needs_review` handling in `harm-gate.ts`: writes a `ReviewQueueEntry` to `runs/review-queue.jsonl` via `storage.ts` (FR-002a) (depends on T014, T009)
- [x] T017 [US1] Wire `harm-gate.ts` into `run-pipeline.ts` as the mandatory first call; `reject`/`needs_review` short-circuit before any other step executes (FR-006) (depends on T015, T016, T010)
- [x] T018 [P] [US1] `src-pipeline/tests/harm-gate.test.ts`: private-individual claim → reject with rule; public-figure-public-conduct claim → accept; non-falsifiable claim → reject with a distinct rule; borderline/uncertain claim → `needs_review` with reason written to the queue file; confirm zero further `MockLlmClient` calls recorded after a `reject`/`needs_review` (depends on T017)

**Checkpoint**: The harm gate is independently verifiable — nothing downstream of a rejection or review-routing ever executes.

---

## Phase 4: User Story 2 - Bring your own key (Priority: P1) 🎯 MVP

**Goal**: A caller-supplied key is required, used only for its own run, and never retained
anywhere this feature writes to.

**Independent Test**: spec.md's 3 acceptance scenarios for User Story 2.

### Implementation for User Story 2

- [x] T019 [US2] Implement the key-required precondition in `src-pipeline/index.ts`: throws (a programmer error, not a normal return) only for an empty/missing `apiKey` string (FR-007) (depends on T011)
- [x] T020 [US2] Audit every module touching `apiKey`: confirm it is passed only to `GeminiLlmClient`'s constructor and never appears on any object serialized into a `ReviewQueueEntry`, `FetchRecord`, or `PipelineResult` (FR-008, FR-009) (depends on T007, T016)
- [x] T021 [US2] Implement authorization-failure detection in `GeminiLlmClient`: catches the SDK's own auth-error shape and surfaces a distinct, named failure the orchestrator can tell apart from every other failure category (FR-010) (depends on T007)
- [x] T022 [P] [US2] `src-pipeline/tests/index.test.ts`: confirms `runPipeline` throws for an empty `apiKey`; confirms no code path writes the key string to any file under `runs/` (depends on T019, T020)
- [x] T023 [P] [US2] Grep-based test asserting no supplied test key string appears in any file under `runs/` after a full mock run (SC-003) (depends on T020)

**Checkpoint**: Key handling is independently verifiable without needing a real key at all.

---

## Phase 5: User Story 3 - Find and retrieve real sources for the claim (Priority: P1) 🎯 MVP

**Goal**: Real, live-web sources are found and retrieved — never fabricated, never substituted
with model memory.

**Independent Test**: spec.md's 4 acceptance scenarios for User Story 3.

### Implementation for User Story 3

- [x] T024 [US3] Implement the search-effort stopping condition in `src-pipeline/search.ts` per the accepted FR-011 clarification: stop at 2+ distinct-domain candidate clusters (a proxy for independence ahead of `001`'s real clustering) or N consecutive empty search attempts, whichever comes first (depends on T005)
- [x] T025 [US3] Implement candidate discovery in `search.ts` using `LlmClient.generateWithSearch`, parsing `groundingUrls` into `CandidateOrigin[]` (FR-011) (depends on T024)
- [x] T026 [US3] Implement zero-candidates handling in `search.ts`: returns an empty array rather than fabricating a source (FR-015, FR-016) (depends on T025)
- [x] T027 [US3] Implement real HTTP retrieval in `src-pipeline/retrieve.ts` using Node's built-in `fetch`, per candidate, independent of the search step's own grounding metadata (research.md §3) (depends on T026)
- [x] T028 [US3] Implement fetch archival in `retrieve.ts`: records `requestedUrl`/`finalUrl`/`succeeded`/`httpStatus`/`contentHash` (sha256)/`fetchedAt` for every attempt, success or failure, appended via `storage.ts` to `runs/fetch-archive.jsonl` (FR-013) (depends on T027, T009)
- [x] T029 [US3] Implement `could_not_retrieve` handling in `retrieve.ts` per the accepted FR-014 clarification: any fetch failure OR a detected paywall/snippet-only response sets `content: null` (FR-014) (depends on T028)
- [x] T030 [P] [US3] `src-pipeline/tests/search.test.ts`: stopping condition fires at 2 distinct-domain candidates; fires after N empty attempts; zero-candidate case returns an empty array (depends on T026)
- [x] T031 [P] [US3] `src-pipeline/tests/retrieve.test.ts` (mocking global `fetch`): successful fetch archives a real hash; failed fetch still archives a record with `succeeded: false`; a mocked paywall-shaped response sets `content: null` (depends on T029)

**Checkpoint**: Source discovery and retrieval are independently verifiable — every origin traces to a real, checkable fetch attempt.

---

## Phase 6: User Story 4 - Grade each retrieved origin blind to the claim's direction (Priority: P1) 🎯 MVP

**Goal**: Warrant grading is architecturally blind — the claim is never reachable from inside the
grading call.

**Independent Test**: spec.md's 4 acceptance scenarios for User Story 4.

### Implementation for User Story 4

- [x] T032 [US4] Implement the grading rubric constant (D1–D4, upgrade triggers, interested-party questions, verbatim from AGENT-PROTOCOL-v3.md Step 3) in `src-pipeline/grade.ts` (FR-020)
- [x] T033 [US4] Implement `gradeOrigin(origin, llm, rubric)` in `grade.ts` with the no-claim-parameter signature from research.md §6 (FR-020, SC-006) (depends on T032, T029)
- [x] T034 [US4] Implement the fired-trigger mechanism requirement in `grade.ts`: a grading response that fires a trigger without naming a mechanism is rejected/retried (FR-021) (depends on T033)
- [x] T035 [US4] Implement could-not-retrieve forcing in `grade.ts`: an origin with `content: null` grades as bare assertion without calling the LLM at all (FR-022) (depends on T033)
- [x] T036 [US4] Implement retraction/correction handling in `grade.ts` per the source's own signals (FR-023) (depends on T033)
- [x] T037 [US4] Implement the 5-to-4 warrant-grade mapping in `grade.ts`: re-testable/reproducible and physical/documentary both map to `001`'s `physical_documentary` (FR-024) (depends on T033)
- [x] T038 [US4] Implement upgrade-trigger verification in `grade.ts`: fires only on a named demonstrated property, never presumed, never above `physical_documentary` (FR-025) (depends on T037)
- [x] T039 [P] [US4] `src-pipeline/tests/grade.test.ts`: the exact prompt sent to the LLM is asserted to never contain a claim string, by construction; a trigger without a mechanism is rejected/retried; `content: null` short-circuits to assertion with zero LLM calls; an upgrade trigger cannot exceed `physical_documentary` (depends on T038)

**Checkpoint**: Grading is independently verifiable, including the architectural blindness property itself.

---

## Phase 7: User Story 5 - Mark each surviving line's diagnosticity against the claim (Priority: P1) 🎯 MVP

**Goal**: Every surviving origin gets a diagnosticity mark, and the whole pipeline assembles into
a `LedgerInput` `001`'s engine accepts.

**Independent Test**: spec.md's 3 acceptance scenarios for User Story 5, plus the full pipeline's
own end-to-end check.

### Implementation for User Story 5

- [x] T040 [US5] Implement `markDiagnosticity(origin, claim, rivals, llm)` in `src-pipeline/diagnosticity.ts` — the claim-visible counterpart to `grade.ts` (FR-026, FR-027) (depends on T005)
- [x] T041 [US5] Implement the three-value mark enforcement in `diagnosticity.ts`: every surviving origin receives exactly one of consistent/inconsistent/not_applicable, never left unmarked (FR-026) (depends on T040)
- [x] T042 [US5] Implement `src-pipeline/assemble-ledger.ts`: combines `RetrievedOrigin[]`, `GradingOutput[]`, `DiagnosticityOutput[]` into `001`'s `LedgerInput` shape, validated with the same zod schema `001`'s own `validate.ts` uses before returning (FR-033) (depends on T041, T038)
- [x] T042a Implement `src-pipeline/classify.ts`'s `classifyClaim(claim, llm)`: Step 1 claim-type classification and the extraordinary-claim flag (FR-036a) — added during implementation, not in the original breakdown (depends on T005)
- [x] T043 [US5] Wire search → retrieve → grade → diagnosticity → assemble-ledger into `run-pipeline.ts`'s orchestration, replacing the Phase 2 stubs, for the accept path (depends on T042, T029, T017)
- [x] T044 [P] [US5] `src-pipeline/tests/diagnosticity.test.ts`: consistent/inconsistent/not_applicable marks produced correctly against a mock claim/origin pair (depends on T041)
- [x] T045 [P] [US5] `src-pipeline/tests/assemble-ledger.test.ts`: a complete set of mock grading+diagnosticity outputs assembles into a `LedgerInput` that `001`'s own `evaluate()` accepts with no `refusalReason` (FR-033, SC-004) (depends on T042)
- [x] T046 [US5] `src-pipeline/tests/run-pipeline.test.ts`'s first case: accept → search → retrieve → grade → diagnosticity → assemble, end to end against `MockLlmClient`, producing a `PipelineResult { kind: 'completed' }` whose ledger `evaluate()` accepts (depends on T043)

**Checkpoint**: MVP complete. User Stories 1–5 together produce a usable, engine-accepted ledger for an in-scope claim, fully verifiable without a real API key.

---

## Phase 8: User Story 6 - Identify at least one plausible rival explanation (Priority: P2)

**Goal**: A genuine alternative explanation is proposed and marked against every surviving
origin, without being treated as evidence itself.

**Independent Test**: spec.md's 2 acceptance scenarios for User Story 6.

### Implementation for User Story 6

- [x] T047 [US6] Implement `generateRivals(claim, llm)` in `src-pipeline/rivals.ts`: proposes at least one plausible alternative explanation (FR-028) (depends on T005)
- [x] T048 [US6] Implement hypothesis-not-evidence framing in `rivals.ts`: a rival's description is stored as something to test, never fed back into grading or treated as a fact about reality (FR-029) (depends on T047)
- [x] T049 [US6] Extend `diagnosticity.ts`'s `markDiagnosticity` to also mark every surviving origin against every proposed rival, reusing the same three-value scale (FR-030) (depends on T041, T048)
- [x] T050 [US6] Wire `rivals.ts` into `run-pipeline.ts` between grading and diagnosticity (depends on T049, T043)
- [x] T051 [P] [US6] `src-pipeline/tests/rivals.test.ts`: at least one rival proposed; the rival is distinct from the claim's own framing; rivals never appear anywhere `grade.ts` reads from (depends on T050)

**Checkpoint**: Rival identification is independently functional and additive — US1–US5 still pass unchanged.

---

## Phase 9: User Story 7 - Adversarial testing and steelman (Priority: P3)

**Goal**: The claim's lead evidence is deliberately tested; the honest default is `untested`, not
a fabricated pass.

**Independent Test**: spec.md's 2 acceptance scenarios for User Story 7.

### Implementation for User Story 7

- [x] T052 [US7] Implement `runAdversarialTest(claim, ledgerSoFar, llm)` in `src-pipeline/adversarial.ts`: attempts to falsify the lead evidence, records `survived`/`untested` per `001`'s `AdversarialStatus` (FR-031) (depends on T005)
- [x] T053 [US7] Implement revision detection in `adversarial.ts`: a changed assessment sets `revisionOccurred: true` (FR-032) (depends on T052)
- [x] T054 [US7] Wire `adversarial.ts` into `run-pipeline.ts` as the final step before `assemble-ledger.ts` (depends on T053, T050)
- [x] T055 [P] [US7] `src-pipeline/tests/adversarial.test.ts`: `untested` is the honest default when no test actually ran; `survived` requires a completed adversarial pass; a changed assessment sets `revisionOccurred` (depends on T054)

**Checkpoint**: All seven user stories are independently functional.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [x] T056 [P] Implement the seed structural registry in `src-pipeline/registry.ts`: `RegistryEntry[]` data (FR-037) and `classifyDomain(url)` lookup, used by `retrieve.ts`
- [x] T057 Implement aggregator trace-through: an aggregator-classed origin is traced to its original source when findable, else graded as its actual (typically low) warrant type, never inflated (FR-038) (depends on T056, T037)
- [x] T058 [P] `src-pipeline/tests/registry.test.ts`: a known seed-listed aggregator domain classifies correctly; an unlisted domain classifies as `null` (treated as original) (FR-039, SC-009) (depends on T056)
- [x] T059 [P] Implement the fetched-content containment wrapper (research.md §7) as a shared helper used by every prompt-building call that includes fetched content (FR-017)
- [x] T060 Implement `detectInstructionEcho()` in `retrieve.ts` (FR-018, FR-019) (depends on T059)
- [x] T061 [P] `src-pipeline/tests/contain.test.ts`: fetched content reaching a prompt is always wrapped in the delimiter convention; a mock response echoing injected directive-shaped content from a source is flagged (depends on T060)
- [x] T062 Run quickstart.md Part 1 (the automated section) in full and record the results
- [x] T063 [P] Add `src-pipeline/README.md` documenting the CLI and the mock-vs-live testing split, linking to contracts/pipeline-api.md
- [x] T064 Re-run the Constitution Check gate from plan.md against the finished implementation and update its Post-Phase-1 re-check note with the result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational only — independent of US1, though both gate the same `index.ts` entry point.
- **User Story 3 (Phase 5)**: Depends on Foundational only — independent of US1/US2.
- **User Story 4 (Phase 6)**: Depends on Foundational and US3 (grades what US3 retrieved).
- **User Story 5 (Phase 7)**: Depends on US3 and US4 (assembles what both produced) and US1 (the orchestration wiring in T043 needs the harm-gate short-circuit from T017 already in place).
- **User Story 6 (Phase 8)**: Depends on US5 (extends the already-wired diagnosticity step).
- **User Story 7 (Phase 9)**: Depends on US6 (slots in after rivals in the wired orchestration) — could be reordered to depend on US5 directly if US6 is skipped for a given release.
- **Polish (Phase 10)**: Depends on whichever user stories are in scope being complete.

### Parallel Opportunities

- All `[P]` Setup tasks (T002–T004).
- **User Stories 1, 2, and 3 have no dependency on each other** and can be staffed in parallel once Phase 2 is done — they touch entirely different files (`harm-gate.ts`, `index.ts`/`llm-client.ts` key handling, `search.ts`/`retrieve.ts`).
- Test-writing tasks marked `[P]` within a story can run alongside the next story's implementation once their own story's implementation tasks are done.

## Implementation Strategy

### MVP First (User Stories 1 through 5)

Spec.md marks all five as P1 for a reason: a pipeline missing any one of harm-gate, BYOK, real
retrieval, blind grading, or diagnosticity isn't a defensible MVP of this specific feature, unlike
`001`/`002` where a single P1 story stood alone. MVP = Phases 1–7:

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phases 3, 4, and 5 (US1, US2, US3) — can be staffed in parallel.
3. Complete Phase 6 (US4), then Phase 7 (US5).
4. **STOP and VALIDATE**: run quickstart.md Part 1 in full, then quickstart.md Part 2 with a real
   key on at least one well-known claim, before adding rivals or adversarial testing.

### Incremental Delivery After MVP

5. Add Phase 8 (US6 — rivals).
6. Add Phase 9 (US7 — adversarial/steelman).
7. Phase 10 (Polish) once every story planned for this release is in.

## Notes

- Every constraint copied into a task above (the FR-011/FR-014 clarified rules, the no-claim-
  parameter signature, the 5-to-4 grade mapping) is copied verbatim from spec.md/research.md/
  data-model.md — no task here should require re-deriving them from AGENT-PROTOCOL-v3.md.
- This feature touches no file under `001`'s `src/trees/`, `src/normalize/`, or `src/aggregate/`
  — its own fixture suite and merge-gate discipline are unaffected.
- Live validation (does Gemini's grounding actually find good sources, is its judgment sound) is
  explicitly not an automated task in this list — quickstart.md Part 2 covers it as a manual step
  for whoever runs this with a real key.

---

## Phase 11: User Story 8 - Bounded Remediation (Amendment, Priority: P1)

Added after the original 64 tasks were complete, per a real gap the constitution's Development
Workflow section required from the start (research.md §8-10, spec.md FR-040-045).

**Goal**: Every step's LLM call is retried with the specific violation quoted back on a
validation failure, up to a fixed limit, with every attempt traced — never a silent drop, a
crash, or a fabricated default.

**Independent Test**: spec.md's 4 acceptance scenarios for User Story 8.

- [x] T065 Implement `remediate<T>(llm, buildPrompt, validate, maxAttempts)` in `src-pipeline/remediate.ts`: calls `buildPrompt(undefined)` on attempt 1, `buildPrompt(violationText)` on each retry, records a `RemediationAttempt` per call, returns `{ ok: true, value, attempts }` or `{ ok: false, attempts }` after `maxAttempts` (FR-040, FR-041, FR-043) (depends on data-model.md's `RemediationAttempt` type)
- [x] T066 [P] Define `MAX_REMEDIATION_ATTEMPTS = 2` in `remediate.ts` as a named, documented constant (FR-042, research.md §9)
- [x] T067 Add the `needs_clarification` variant to `PipelineResult` in `types.ts` (research.md §10) (depends on T065)
- [x] T068 Update `run-pipeline.ts`: every step call (`classifyClaim`, `discoverCandidates`, `gradeOrigin` per origin, `markDiagnosticity` per origin, `generateRivals`, `runAdversarialTest`, and the harm gate's own classifier call) routes through `remediate()`; the orchestrator returns `{ kind: 'needs_clarification', step, questions }` immediately on any step's remediation exhaustion (FR-044) (depends on T065, T067)
- [x] T069 Add `remediationAttempts: RemediationAttempt[]` to `RunTrace`, populated from every step's `remediate()` call (FR-043) (depends on T068)
- [x] T070 Replace `grade.ts`'s `filterTriggersRequiringMechanism` silent-drop behavior: a fired trigger with no mechanism is now a validation failure that triggers remediation via `remediate()`, not a silently filtered array (FR-045) (depends on T065)
- [x] T071 Update `cli.ts`: add exit code `6` for `needs_clarification`, distinct from every other outcome (contracts/pipeline-api.md) (depends on T067)
- [x] T072 [P] `src-pipeline/tests/remediate.test.ts`: succeeds on attempt 1 with no retry; fails attempt 1, succeeds attempt 2, both attempts in the trace; fails every attempt up to the limit, returns `ok: false` with all attempts recorded; the retry prompt actually contains the specific violation text, not a generic message (depends on T066)
- [x] T073 [P] Update `src-pipeline/tests/grade.test.ts`: a trigger with no mechanism now triggers a remediation retry (via a scripted `MockLlmClient` second response), never a silent drop (depends on T070)
- [x] T074 [P] Update `src-pipeline/tests/run-pipeline.test.ts`: add a case where a step's mocked response is invalid on attempt 1 and valid on attempt 2, confirming the orchestrator still reaches `completed`; add a case where a step is invalid on every attempt, confirming `needs_clarification` (depends on T068)
- [x] T075 Re-run the full suite, confirm offline (`unshare --net`), re-run `tsc`/`eslint`, and update plan.md's Constitution Check "Remediation is bounded" row from AMENDED to a plain PASS once implemented and verified

**Checkpoint**: Every generative step in this pipeline now self-corrects on a validation failure within a bounded budget, and fails loud (a specific clarifying question) rather than quiet, matching the constitution's Development Workflow requirement in full.
