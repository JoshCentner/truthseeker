---

description: "Task list template for feature implementation"

---

# Tasks: Rule Engine Dev UI

**Input**: Design documents from `/specs/002-engine-dev-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no
`contracts/` — this feature exposes no API of its own, see plan.md)

**Tests**: Not separately requested. Lightweight Vitest+jsdom tests are included as first-class
implementation tasks per research.md §3, not as a pre-implementation TDD phase.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P2/P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unmet dependency)
- **[Story]**: Which user story this task belongs to (US1–US3)
- File paths follow plan.md's Project Structure (`ui/` and `ui/tests/` at repo root)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Add `vite` as a devDependency in `package.json` and add `"dev": "vite"`, `"build": "vite build"`, `"preview": "vite preview"` npm scripts
- [x] T002 [P] Create `vite.config.ts` at the repo root with `root: 'ui'` (plan.md Project Structure)
- [x] T003 [P] Create `ui/index.html` with three empty containers: editor, fixture list, results panel
- [x] T004 [P] Create `ui/style.css`: neutral palette, single typeface, layout skeleton per research.md §5 (no framework, no distinctive branding — a deliberate, documented choice for this internal tool)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T005 Define `Mode`, `LedgerDraft`, `EngineResult`, `FixtureLibraryEntry`, `VerdictDisplayState` types in `ui/types.ts` exactly per data-model.md
- [x] T006 Implement `run(draft: LedgerDraft): EngineResult` in `ui/engine-bridge.ts`: `JSON.parse` the draft's `rawText`, catching a parse failure into `{ kind: 'parse-error' }` (FR-006) before ever calling the engine; on successful parse, call `evaluate()` (mode `'evaluate'`) or `aggregate()` (mode `'aggregate'`) imported directly from `../src/index.ts` (FR-003, FR-012); unwrap a non-null `refusalReason` into `{ kind: 'refusal' }` (FR-007); otherwise return `{ kind: 'verdict' }` (depends on T005)
- [x] T007 `ui/main.ts`: boot skeleton wiring `index.html`'s three containers to empty editor/fixture-list/results modules (filled in by later phases) (depends on T003)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Evaluate a pasted ledger (Priority: P1) 🎯 MVP

**Goal**: Paste or type a ledger, run it, see the full verdict with its trace — or a clear,
specific error if the input is malformed or refused.

**Independent Test**: spec.md's 4 acceptance scenarios for User Story 1.

### Implementation for User Story 1

- [x] T008 [P] [US1] Implement the text area and an explicit Run button in `ui/ledger-editor.ts`, updating `LedgerDraft.rawText` on input and calling `engine-bridge.run()` only on the Run action, never on keystroke (FR-001, FR-002)
- [x] T009 [US1] Implement the mode toggle (`evaluate` / `aggregate`) in `ui/ledger-editor.ts`, resetting `LedgerDraft` per data-model.md's State flow when switched (FR-010) (depends on T008)
- [x] T010 [P] [US1] Implement `renderVerdict(verdict: Verdict)` in `ui/verdict-display.ts`: band, qualifier (when present), tree, every `conditionsMet` entry, every `cappingConditions` entry — each condition's `protocolClause` text shown in full (FR-004)
- [x] T011 [US1] Implement version-stamp display (`engineVersion`, `schemaVersion`) in `ui/verdict-display.ts` (FR-005) (depends on T010)
- [x] T012 [P] [US1] Implement `renderParseError(message: string)` in `ui/verdict-display.ts`, visually distinct from a computed verdict (FR-006)
- [x] T013 [P] [US1] Implement `renderRefusal(reason: string)` in `ui/verdict-display.ts`, showing the engine's `refusalReason` verbatim, visually distinct from both a parse error and a computed verdict (FR-007)
- [x] T014 [US1] Wire `ui/main.ts`: Run action → `engine-bridge.run(draft)` → dispatch on `EngineResult.kind` to the matching `verdict-display` render function (depends on T009, T011, T012, T013)
- [x] T015 [P] [US1] `ui/tests/engine-bridge.test.ts`: cases for a valid ledger (→ `verdict`), invalid JSON (→ `parse-error`), and schema-invalid JSON (→ `refusal`) (depends on T006)
- [x] T016 [P] [US1] `ui/tests/verdict-display.test.ts` (`// @vitest-environment jsdom`): asserts each render function produces DOM containing the expected band/error/refusal text, and that a below-ceiling verdict's capping conditions are always present in the rendered output (SC-003) (depends on T010, T012, T013)

**Checkpoint**: User Story 1 is independently functional — pasting any of the engine's own fixture inputs and running them reproduces the expected verdict, per spec.md's Independent Test for this story.

---

## Phase 4: User Story 2 - Start from a known fixture (Priority: P2)

**Goal**: Browse the engine's existing fixture cases and load one into the editor as a starting
point.

**Independent Test**: spec.md's 2 acceptance scenarios for User Story 2.

### Implementation for User Story 2

- [x] T017 [US2] Implement fixture discovery in `ui/fixture-library.ts` using `import.meta.glob('/tests/fixtures/cases/*.ts', { eager: true })`, building `FixtureLibraryEntry[]` from each module's `case_` export (research.md §2, FR-008)
- [x] T018 [US2] Render the fixture list in `ui/fixture-library.ts` (id + protocol clause per entry), and wire selection to populate `LedgerDraft` via `JSON.stringify(entry.raw.input, null, 2)` and set `mode` from the entry (FR-009) (depends on T017, T009)
- [x] T019 [P] [US2] `ui/tests/fixture-library.test.ts`: confirms every real fixture file under `tests/fixtures/cases/` is discovered exactly once, and that selecting an entry produces a `LedgerDraft` whose `rawText` parses back to that fixture's exact `input` (depends on T017)

**Checkpoint**: Selecting any of the engine's fixtures and running it reproduces that fixture's expected verdict — User Story 1 + 2 together make the tool usable without knowing the schema by heart.

---

## Phase 5: User Story 3 - Evaluate a compound (aggregation) claim (Priority: P3)

**Goal**: Build or paste a compound input, optionally with a `previous` sub-claim state, and see
the aggregated verdict.

**Independent Test**: spec.md's 2 acceptance scenarios for User Story 3.

### Implementation for User Story 3

- [x] T020 [US3] Extend `ui/engine-bridge.ts`'s `run()` to pass `draft.previousSubClaims` through to `aggregate(input, previous)` when `mode === 'aggregate'` and a previous state is present (FR-011) (depends on T006)
- [x] T021 [US3] Add an optional "previous sub-claims" field to the aggregate-mode editor in `ui/ledger-editor.ts`, populating `LedgerDraft.previousSubClaims` (FR-011) (depends on T009)
- [x] T022 [US3] Extend `ui/verdict-display.ts`'s `renderVerdict` to show `movedBy` when the engine sets it (depends on T010)
- [x] T023 [P] [US3] `ui/tests/engine-bridge.test.ts`: add cases for a cyclic compound input (→ `refusal`, citing FR-040's message) and a `previous`-supplied recompute (→ `verdict` with the expected `movedBy`) (depends on T020)

**Checkpoint**: All three user stories are independently functional — the tool now covers both engine entry points (`evaluate()` and `aggregate()`).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T024 [P] Implement copy-to-clipboard for the current verdict as JSON in `ui/clipboard.ts` (FR-013)
- [x] T025 [P] Extend `ui/verdict-display.ts` to render the `dependenceMap` when present on a single-claim verdict (FR-014)
- [x] T026 Run quickstart.md's full validation sequence (SC-001 through SC-006, plus the aggregation check) and record the results
- [x] T027 [P] Confirm zero network requests via `npm run build && npm run preview`, checked with the browser's Network tab or `unshare --net` (SC-005)
- [x] T028 Re-run the Constitution Check gate from plan.md against the finished implementation and record the result in plan.md's Post-Phase-1 re-check note

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational and on US1's mode toggle (T009) to know which draft shape to populate.
- **User Story 3 (Phase 5)**: Depends on Foundational and on US1's mode toggle (T009); independent of US2.
- **Polish (Phase 6)**: Depends on whichever user stories are in scope for this release being complete.

### Parallel Opportunities

- All `[P]` Setup tasks (T002–T004).
- T010, T012, T013 (three independent render functions in `verdict-display.ts`, different concerns, safe to build in parallel before converging at T014).
- **User Story 2 and User Story 3 have no dependency on each other** — both depend only on Foundational + US1's mode toggle, so they can be staffed in parallel despite their priority order.
- T024/T025 (Polish) touch different files/functions and can run in parallel.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1).
3. **STOP and VALIDATE**: run quickstart.md's User Story 1 section — paste a fixture's input by
   hand, confirm the verdict matches, confirm a malformed input produces a clear error.

### Incremental Delivery After MVP

4. Add Phase 4 (US2) — the tool becomes usable without memorizing the schema.
5. Add Phase 5 (US3), any time after Phase 2 — can run in parallel with Phase 4 if staffed.
6. Phase 6 (Polish) once every story planned for this release is in.

## Notes

- Every constraint copied into a task above (exact `import.meta.glob` pattern, the three
  `EngineResult` kinds, the state-reset rule on mode switch) is copied verbatim from
  data-model.md/research.md — no task here should require re-deriving them from the spec.
- This feature adds no fixture cases and touches no file under `src/trees/`, `src/normalize/`, or
  `src/aggregate/` — `001`'s own fixture suite and merge-gate discipline are unaffected.
