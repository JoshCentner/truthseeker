---

description: "Task list template for feature implementation"

---

# Tasks: Claim Dashboard

**Input**: Design documents from `/specs/004-claim-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/dashboard-api.md,
quickstart.md (all present)

**Tests**: Not separately requested. Every test uses `MockLlmClient` (from `003`) — none need a
real API key or network access; live validation is quickstart.md Part 2's job, not an automated
task.

**Organization**: Tasks are grouped by user story (spec.md priorities P1×3/P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Which user story this task belongs to (US1–US4)
- File paths follow plan.md's Project Structure (`dashboard/`, `dashboard/tests/`, and new files
  inside `002`'s existing `ui/`)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Create `dashboard/` and `dashboard/tests/` directories
- [x] T002 [P] Add `dashboard.html` as a second Vite entry point in `vite.config.ts`, alongside `002`'s existing `index.html` (research.md §5)
- [x] T003 Add a `server.proxy` rule in `vite.config.ts` forwarding `/api/*` to the Node server's port during `npm run dev` (research.md §5)
- [x] T004 [P] Add an npm script `"dashboard:server": "tsx dashboard/server.ts"` to `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Add `onProgress?: (step: string) => void` to `003`'s `RunOptions` in `src-pipeline/types.ts` (research.md §2, data-model.md) — additive and optional, no existing caller changes
- [x] T006 Call `onProgress` from `run-pipeline.ts`'s existing `stamp()` helper immediately after recording each step (depends on T005)
- [x] T007 [P] Define `RunRequest`, `ServerEvent`, and `DashboardState` types per data-model.md — `RunRequest`/`ServerEvent` in `dashboard/types.ts`, `DashboardState` in `ui/dashboard-types.ts`
- [x] T008 [P] Implement SSE-formatting helpers in `dashboard/sse.ts`: `writeEvent(res, event: ServerEvent)` writing the exact `event:`/`data:` framing from data-model.md
- [x] T009 Implement `run-with-progress.ts`: wraps `003`'s `runPipeline()`, wiring `onProgress` to a caller-supplied emit function, and exposes an `AbortController` the caller can trigger between steps (research.md §4) (depends on T006)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Submit a claim and see whatever outcome results, clearly (Priority: P1) 🎯 MVP

**Goal**: `POST /api/run` runs `003`'s pipeline and streams back a `result` event for each of its
four outcome kinds; the dashboard renders each distinctly.

**Independent Test**: spec.md's 4 acceptance scenarios for User Story 1.

### Implementation for User Story 1

- [x] T010 [US1] Implement `dashboard/server.ts`'s `POST /api/run` handler: parses the `RunRequest` body, calls `run-with-progress.ts`, streams the `result` event via `sse.ts` (FR-001, FR-002) (depends on T008, T009)
- [x] T011 [P] [US1] Implement `ui/dashboard-client.ts`: submits the form via `fetch()`, reads the streamed response, updates `DashboardState` per data-model.md's State flow (research.md §3) (depends on T007)
- [x] T012 [P] [US1] Implement `ui/dashboard-display.ts`: renders `'completed'` as the band + trace (not raw JSON), `'rejected'` with its rule, `'needs_review'` with its reason, `'needs_clarification'` with its questions — each visually distinct (FR-002, FR-008, FR-009, FR-010) (depends on T007)
- [x] T013 [US1] Implement `ui/dashboard-main.ts`: boots the dashboard page, wires the form to `dashboard-client.ts`, wires state updates to `dashboard-display.ts` (depends on T011, T012)
- [x] T014 [P] [US1] `dashboard/tests/server.test.ts`: a mocked run of each of the four `PipelineResult.kind`s streams the matching `result` event (depends on T010)
- [x] T015 [P] [US1] `ui/tests/dashboard-display.test.ts` (jsdom): each `PipelineResult.kind` renders visibly distinct DOM content, never raw JSON for a `completed` result (depends on T012)

**Checkpoint**: Every one of `003`'s four outcomes is submittable and renders distinctly — the dashboard's core loop works end to end against `MockLlmClient`.

---

## Phase 4: User Story 2 - Provide your own API key, used only for that submission (Priority: P1) 🎯 MVP

**Goal**: The key never leaves the request handler's closure, is required before any run starts,
and an auth failure is shown distinctly from every other outcome.

**Independent Test**: spec.md's 3 acceptance scenarios for User Story 2.

### Implementation for User Story 2

- [x] T016 [US2] Implement key-required validation in `server.ts`'s request handler: a missing `claim` or `apiKey` in the body returns a 4xx before `runPipeline()` is ever called (FR-004) (depends on T010)
- [x] T017 [US2] Implement the key-entry field in `ui/dashboard-main.ts`'s form: required, never pre-filled, never logged to the browser console (FR-004)
- [x] T018 [US2] Extend `dashboard-display.ts` to render `auth_failed` distinctly from `rejected`/`needs_review`/`needs_clarification`/`completed` (FR-002, already partially covered by T012 — this task adds the fifth, auth-specific case) (depends on T012)
- [x] T019 [P] [US2] `dashboard/tests/server.test.ts`: confirms the parsed `apiKey` string never appears in any log call or file write made during a mocked run (SC-002, mirroring `003`'s `key-isolation.test.ts` pattern) (depends on T016)
- [x] T020 [P] [US2] `ui/tests/dashboard-client.test.ts`: submitting without a key never calls `fetch()` at all (FR-004)

**Checkpoint**: Key handling is independently verifiable without a real key, mirroring `003`'s own key-isolation guarantees at this feature's request/response boundary.

---

## Phase 5: User Story 3 - Watch live progress while a claim is processed (Priority: P1) 🎯 MVP

**Goal**: The displayed step advances as the real run progresses; a remediation retry never looks
like a failure.

**Independent Test**: spec.md's 2 acceptance scenarios for User Story 3.

### Implementation for User Story 3

- [x] T021 [US3] Extend `server.ts`'s handler to write a `progress` SSE event immediately on each `onProgress` call, before the run continues to the next step (FR-005) (depends on T010, T009)
- [x] T022 [US3] Extend `dashboard-client.ts` to update `DashboardState.currentStep` on every `progress` event as it streams in, not only on the final `result` (FR-005) (depends on T011)
- [x] T023 [US3] Extend `dashboard-display.ts`'s `'running'` phase rendering to show the current step name; ensure a step name repeating (a remediation retry within the same step) is shown as continued progress, not a new error state (FR-006) (depends on T012, T022)
- [x] T024 [US3] Implement the disconnect-aborts-the-run behavior in `server.ts`: listens for the request's `close` event and triggers `run-with-progress.ts`'s `AbortController` (research.md §4) (depends on T010, T009)
- [x] T025 [P] [US3] `dashboard/tests/server.test.ts`: a mocked run with a scripted remediation retry on one step streams two `progress` events for that step, not an error; simulating a client disconnect mid-run stops further mock LLM calls (depends on T021, T024)
- [x] T026 [P] [US3] `ui/tests/dashboard-client.test.ts`: a scripted fake stream with multiple `progress` events updates `DashboardState.currentStep` at each one, in order (depends on T022)

**Checkpoint**: All three P1 stories are independently functional — this is the dashboard's MVP.

---

## Phase 6: User Story 4 - See the full evidence trail in plain language (Priority: P2)

**Goal**: A completed verdict's origins, grades, diagnosticity marks, and capping conditions are
all shown together in plain language, not `001`'s raw field names.

**Independent Test**: spec.md's 2 acceptance scenarios for User Story 4.

### Implementation for User Story 4

- [x] T027 [US4] Extend `dashboard-display.ts`'s `'completed'` rendering: every origin's URL, warrant grade, and diagnosticity mark against the claim shown together per origin, not in separate unrelated sections (FR-007) (depends on T012)
- [x] T028 [US4] Implement plain-language capping-condition text in `dashboard-display.ts`: translates a capping condition's protocol-clause string into a reader-facing sentence about what would need to be true for a higher band (FR-007) (depends on T027)
- [x] T029 [P] [US4] `ui/tests/dashboard-display.test.ts`: given a completed verdict with origins of mixed diagnosticity marks, confirms both a supporting and a non-supporting origin are identifiable from the rendered DOM (SC-004) (depends on T028)

**Checkpoint**: All four user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T030 [P] `dashboard/tests/server.test.ts`: two concurrent mocked requests with different claims never see each other's progress or result (SC-005)
- [x] T031 Run quickstart.md Part 1 (the automated section) in full and record the results
- [x] T032 [P] Add `dashboard/README.md` documenting the server, the SSE contract, and the mock-vs-live testing split, linking to contracts/dashboard-api.md
- [x] T033 Re-run the Constitution Check gate from plan.md against the finished implementation and update its Post-Phase-1 re-check note with the result

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational and on US1's server handler (T010) and display module (T012) existing to extend.
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's server handler and client existing to extend; independent of US2.
- **User Story 4 (Phase 6)**: Depends on US1's display module (T012) existing to extend; independent of US2/US3.
- **Polish (Phase 7)**: Depends on whichever user stories are in scope being complete.

### Parallel Opportunities

- All `[P]` Setup tasks (T001, T002, T004).
- T007/T008 (Foundational) touch different files and can run in parallel.
- **User Story 4 has no dependency on User Story 2 or 3** — once US1's display module exists, US4
  can be staffed in parallel with either.
- Test-writing tasks marked `[P]` within a story can run alongside the next story's implementation
  once their own story's implementation tasks are done.

## Implementation Strategy

### MVP First (User Stories 1 through 3)

All three P1 stories together are this feature's MVP, the same reasoning `003` used for its own
five P1 stories: a dashboard that shows outcomes but has no safe key handling, or has key handling
but no progress feedback on a multi-minute run, isn't a defensible first version of *this*
feature.

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1).
3. Complete Phase 4 (US2) and Phase 5 (US3) — independent of each other, can be staffed in
   parallel.
4. **STOP and VALIDATE**: run quickstart.md Part 1 in full, then Part 2 with a real key, before
   adding the plain-language evidence-trail polish.

### Incremental Delivery After MVP

5. Add Phase 6 (US4).
6. Phase 7 (Polish) once every story planned for this release is in.

## Notes

- Every constraint copied into a task above (the exact SSE event shapes, the abort-on-disconnect
  behavior, the key-never-leaves-closure rule) is copied verbatim from data-model.md/research.md/
  contracts/dashboard-api.md — no task here should require re-deriving them from spec.md alone.
- This feature adds one additive, optional field to `003`'s `RunOptions` and nothing else to any
  prior feature's files — `001`'s, `002`'s, and `003`'s own test suites are unaffected.
