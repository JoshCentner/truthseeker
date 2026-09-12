---

description: "Task list template for feature implementation"

---

# Tasks: Deterministic Rule Engine, Core Schema, and Fixture Suite

**Input**: Design documents from `/specs/001-rule-engine-core/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/engine-api.md, quickstart.md (all present)

**Tests**: Not separately requested (no TDD instruction in spec.md). This feature's correctness
*is* its fixture suite (User Story 3), so fixture-case creation and suite-running are first-class
implementation tasks within each story rather than an optional pre-implementation test phase.

**Organization**: Tasks are grouped by user story (spec.md priorities P1/P1/P1/P2/P3) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- File paths below follow plan.md's Project Structure (single project: `src/`, `tests/` at repo root)

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create the directory structure from plan.md's Project Structure: `src/schema/`, `src/normalize/`, `src/trees/`, `src/aggregate/`, `src/verdict/`, `tests/fixtures/cases/`, `tests/unit/`, `tests/suite/`
- [x] T002 Initialize `package.json`: TypeScript 5.x, `engines.node >= 20`, Vitest as the only devDependency needed for testing, Zod as the only runtime dependency (plan.md Technical Context)
- [x] T003 [P] Configure `tsconfig.json` in strict mode (`strict: true`, `noUncheckedIndexedAccess: true`) to support the `LedgerInput`/`Verdict` structural separation from data-model.md
- [x] T004 [P] Configure `vitest.config.ts` to include `tests/**/*.test.ts` and report timing, so SC-008's under-60-second full-suite budget is visible on every run
- [x] T005 [P] Configure lint rules (ESLint) banning `Date.now()`, `Math.random()`, and other non-deterministic built-ins anywhere under `src/`, per research.md §2's determinism discipline

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Define shared enums in `src/schema/ledger.ts` exactly as data-model.md specifies: `WarrantGrade = 'assertion' | 'testimony' | 'contemporaneous_record' | 'physical_documentary'`, `ReliabilityGrade = 'fabricator' | 'poor' | 'mixed' | 'reliable' | 'not_rated'`, `ContaminationChannel = 'data' | 'method' | 'institution' | 'motive'`, `DiagnosticMark`, `AdversarialStatus = 'survived' | 'untested'`, `ClaimType`, `Band`, `Qualifier`, `TreeId`
- [x] T007 Define `Origin`, `Warrant`, `EvidenceLine`, `Cluster`, `Rival` types in `src/schema/ledger.ts` per data-model.md's field tables, including every field's exact type and nullability as specified there
- [x] T008 Define `LedgerInput` (and `Tree2Extension`/`Tree3Extension`/`Tree4Extension` placeholders) in `src/schema/ledger.ts` per data-model.md, with no field overlapping `Verdict`'s shape (research.md §3)
- [x] T009 Define `Verdict` type in `src/schema/ledger.ts` per data-model.md — `band`, `qualifier`, `tree`, `conditionsMet`, `cappingConditions`, `engineVersion`, `schemaVersion`, `dependenceMap`, `residue`, `movedBy`, `refusalReason` — structurally separate from `LedgerInput`
- [x] T010 [P] Write the Zod schema for `LedgerInput` in `src/schema/validate.ts` that fails closed on any payload carrying a `Verdict`-only key (e.g. `band`, `cappingConditions`), satisfying FR-003
- [x] T011 [P] Implement a shared `makeRefusal(reason: string): Verdict` helper in `src/schema/validate.ts` that returns a `Verdict` with `refusalReason` set and every other field `null` except `engineVersion`/`schemaVersion`, per FR-008 and contracts/engine-api.md's never-throws contract
- [x] T012 Export `engineVersion` and `schemaVersion` as literal semver string constants from `src/index.ts` and `src/schema/ledger.ts` (research.md §5); start both at `"0.1.0"`
- [x] T013 Create `src/index.ts` with `evaluate(input: LedgerInput): Verdict` and `aggregate(input: CompoundInput, previous?): Verdict` stubs per contracts/engine-api.md, each calling validation first and returning `makeRefusal(...)` on any failure (depends on T010, T011, T012)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Normalize a populated ledger before any band is considered (Priority: P1)

**Goal**: Reduce a populated ledger to the state the trees actually read — surviving lines, each
line's final weight, the cluster partition and count, and the excluded-line list — without
computing any band.

**Independent Test**: spec.md's 7 acceptance scenarios for User Story 1 (bare-assertion ledger →
zero clusters; ten lines → three dependency partitions; cluster grade takes the best member;
Fabricator-graded testimony carries zero weight; interested-party demotion; non-diagnostic
exclusion; retracted origin removes its whole line).

### Implementation for User Story 1

- [x] T014 [P] [US1] Implement the zero-weight rule in `src/normalize/weight.ts`: a line with `finalGrade === 'assertion'` has `survives = false` at any volume; testimony is never zeroed by this rule (FR-009)
- [x] T015 [P] [US1] Implement fired-trigger application in `src/normalize/weight.ts`: one grade step of downgrade per fired trigger with no limit; reject any trigger whose `mechanism` field is empty (FR-012)
- [x] T016 [US1] Implement upgrade-trigger application in `src/normalize/weight.ts`, capping every upgrade at `'physical_documentary'` — no upgrade may cross it (FR-013) (depends on T015)
- [x] T017 [US1] Implement the interested-party table in `src/normalize/weight.ts`: no discount for `'physical_documentary'`; `'contemporaneous_record'` demotes to `'testimony'` only when `interestedParty && partyControlledCreationAfterStakesVisible`; `'testimony'` is treated as assertion for carrying a claim while retaining corroboration value; `'assertion'` stays zero (FR-014) (depends on T016)
- [x] T018 [US1] Implement the source-reliability interaction in `src/normalize/weight.ts`: reliability grade MUST only ever lower a grade, and MUST NOT raise it or convert assertion into evidence (FR-015) (depends on T017)
- [x] T019 [US1] Implement retracted-origin removal in `src/normalize/weight.ts`: `Origin.retracted === true` removes its entire downstream Evidence Line from the ledger (FR-010)
- [x] T020 [US1] Implement could-not-retrieve forcing in `src/normalize/weight.ts`: `Origin.retrievalStatus === 'could_not_retrieve'` forces grading as bare assertion regardless of any claimed type (FR-011)
- [x] T021 [P] [US1] Implement dependency-cluster partitioning in `src/normalize/clusters.ts`: lines sharing any `ContaminationChannel` directly or transitively form one `Cluster` (FR-016)
- [x] T022 [US1] Implement cluster grading in `src/normalize/clusters.ts`: `Cluster.grade` = best member's `WarrantGrade`; internal cluster size adds no further weight (FR-017) (depends on T021)
- [x] T023 [US1] Implement the dependence-map output in `src/normalize/clusters.ts` naming which lines cluster on which shared channels (FR-020) (depends on T022)
- [x] T024 [P] [US1] Implement non-diagnostic exclusion in `src/normalize/diagnosticity.ts`: a line consistent with both the claim and a live rival gets `nonDiagnostic = true` and is excluded from cluster thresholds and warrant requirements while still being reported (FR-018)
- [x] T025 [US1] Implement rival-rebuttal marking in `src/normalize/diagnosticity.ts`: `Rival.rebutted = true` when any surviving line marks it `'inconsistent'` (FR-019) (depends on T024)
- [x] T026 [US1] Wire `weight.ts`, `clusters.ts`, and `diagnosticity.ts` into a single `normalize(input: LedgerInput)` function in `src/normalize/index.ts` returning surviving lines, clusters, the excluded-line list, and the dependence map (depends on T017, T018, T019, T020, T023, T025)

**Checkpoint**: Normalization is independently verifiable against all 7 of spec.md's User Story 1 acceptance scenarios without any band being computed.

---

## Phase 4: User Story 2 - Compute a simple-factual band with its capping conditions (Priority: P1) 🎯 MVP

**Goal**: Given a normalized ledger for a simple factual claim, return a band, the tree used,
every condition met, and the specific conditions that prevented a higher band — with no model
call anywhere in the path.

**Independent Test**: spec.md's 7 acceptance scenarios for User Story 2 (Established via two
clusters + Survived; Probable when Untested; Contested from a single post-dispute cluster;
Contested from an all-non-diagnostic ledger; Unsupported when nothing survives; Refuted on a
retracted load-bearing origin; no numeric score anywhere in output).

### Implementation for User Story 2

- [x] T027 [US2] Implement Tree 1's Established conditions in `src/trees/tree1-simple-factual.ts`: 2+ independent clusters, best grade `'contemporaneous_record'` or better, no unrebutted more-plausible rival, no strong silence finding, `adversarialStatus === 'survived'`; when `screens.priorPlausibility === 'extraordinary'`, additionally require `extraordinaryClusterSurvivedAdversarialTesting === true` (FR-021; FR-031 as clarified — the flag gates Established) (depends on T026)
- [x] T028 [US2] Implement Tree 1's Probable conditions and the extraordinary-flag Contested ceiling in `src/trees/tree1-simple-factual.ts`: `adversarialStatus === 'untested'` caps at Probable; when `screens.priorPlausibility === 'extraordinary'` and `extraordinaryClusterSurvivedAdversarialTesting` is not `true`, the ceiling is Contested for **both** Probable and Established (FR-031 as clarified) (depends on T027)
- [x] T029 [US2] Implement Tree 1's Contested — insufficient evidence outcome in `src/trees/tree1-simple-factual.ts`: fires when every surviving line is non-diagnostic, or when the sole support is a single post-dispute testimony cluster; MUST NOT fire from public controversy, political salience, or opinion volume alone (FR-022, FR-023) (depends on T028)
- [x] T030 [US2] Implement Tree 1's Contested — conflicting evidence outcome in `src/trees/tree1-simple-factual.ts` using the accepted exact-match rule: fires only when diagnostic evidence on both sides matches **exactly** on grade AND cluster count; any mismatch falls through to whichever side is higher under ordinary conditions (FR-034 as clarified) (depends on T029)
- [x] T031 [US2] Implement the Unsupported vs Refuted distinction in `src/trees/tree1-simple-factual.ts`: nothing surviving at any weight → Unsupported (a burden finding, never Contested/Refuted); a retracted load-bearing origin → Refuted (a falsity finding); these MUST NOT substitute for each other (FR-032) (depends on T026)
- [x] T032 [US2] Implement the corroboration-minimum enforcement in `src/trees/tree1-simple-factual.ts`: the uncorroborated/corroborated boundary is **exactly two** clusters, with no threshold set above two (FR-024) (depends on T027)
- [x] T033 [US2] Implement the falsifiability-screen short-circuit in `src/index.ts`'s `evaluate()`: `screens.falsifiability === 'fired'` returns `{ band: 'unfalsifiable', tree: 'screen' }` without calling `normalize()` or any tree (FR-033) (depends on T013)
- [x] T034 [US2] Implement verdict assembly in `src/verdict/assemble.ts`: attach `tree`, `conditionsMet`/`cappingConditions` (each entry carrying a stable id mapped to its AGENT-PROTOCOL-v3.md clause), `engineVersion`, and `schemaVersion` to every Tree 1 result; `cappingConditions` MUST be non-empty whenever the band is below the tree's highest reachable band (FR-042, FR-043, FR-045, FR-046) (depends on T027, T028, T029, T030, T031, T032)
- [x] T035 [US2] Wire Tree 1 into `evaluate()` in `src/index.ts` for `classification.primary === 'simple_factual'` (depends on T033, T034)
- [x] T036 [P] [US2] Write hand-worked Tree 1 fixture cases in `tests/fixtures/cases/` — one TypeScript module per case exporting `{ id, protocolClause, input, expected }` — covering all 7 of spec.md's User Story 2 acceptance scenarios, per research.md §4's fixture format (depends on T035)

**Checkpoint**: Tree 1 fully answers simple-factual claims on its own. US1 + US2 together are the smallest slice that delivers the project's core promise.

---

## Phase 5: User Story 3 - Prove the engine reproduces the methodology (Priority: P1)

**Goal**: A suite of hand-worked cases from the protocol confirms the engine returns exactly the
band the protocol requires for each one, with zero API calls and zero cost.

**Independent Test**: spec.md's 4 acceptance scenarios for User Story 3 (suite runs offline with
no credentials and reports pass/fail for every case; a divergent case names itself, expected,
actual, and the diverging condition; an engine change that moves a boundary fails at least one
case; every band outcome in every implemented tree is exercised).

### Implementation for User Story 3

- [x] T037 [US3] Implement the fixture-suite runner in `tests/suite/run-fixtures.test.ts`: glob-import every case under `tests/fixtures/cases/`, call `evaluate()` or `aggregate()` as the case's shape indicates, and assert `band`/`qualifier`/`tree` per case (FR-047) (depends on T036)
- [x] T038 [US3] Implement per-case failure reporting in `tests/suite/run-fixtures.test.ts`: a failing case's message names the case id, expected band, actual band, and the first diverging condition (FR-050) (depends on T037)
- [x] T039 [US3] Implement coverage reporting in `tests/suite/run-fixtures.test.ts` that fails the run if any band outcome of an already-implemented tree has zero fixture cases exercising it (FR-049, SC-003) (depends on T037)
- [x] T040 [P] [US3] Validate zero-network, zero-credential execution using quickstart.md's `unshare --net npm test` procedure; record that the result matches the networked run exactly (SC-001) (depends on T037)
- [x] T041 [P] [US3] Validate determinism by running the suite twice and diffing JSON reporter output per quickstart.md; confirm no diff (FR-006, SC-004) (depends on T037)
- [x] T042 [US3] Confirm and record the full suite's wall-clock time is under 60 seconds on a developer machine (SC-008) (depends on T037)

**Checkpoint**: The correctness-proving mechanism exists and passes for every tree implemented so far. It re-validates automatically as later phases add fixture cases — no changes to this phase's files are needed when Trees 2–4 and aggregation land.

---

## Phase 6: User Story 4 - Route causal, predictive, and complex-system claims (Priority: P2)

**Goal**: Claims that are not simple factual are routed to their own tree, with each tree's
distinct structure enforced by the engine rather than trusted to a model.

**Independent Test**: spec.md's 7 acceptance scenarios for User Story 4 (causal inheritance from
a low underlying band; temporality disqualifier; discriminating-criterion existence condition;
Tree 3's Probable ceiling; complex-system decomposition and residue; Unresolvable with rationale;
low-confidence dual-tree routing).

### Implementation for User Story 4

- [x] T043 [P] [US4] Define `Tree2Extension`, `Tree3Extension`, `Tree4Extension` types in `src/schema/ledger.ts` exactly per data-model.md's shapes (depends on T009)
- [x] T044 [US4] Implement Tree 2 (causal) in `src/trees/tree2-causal.ts`: inherit the lower band and stop evaluation when `underlyingFactualBand` did not reach Probable (FR-025); disqualify every band above Doubtful when `temporalityFinding === 'absent'` (FR-026); treat the discriminating criterion as an existence condition supportive criteria cannot satisfy at any count, returning Contested — insufficient evidence when only supportive criteria are met (FR-027) (depends on T043, T034)
- [x] T045 [US4] Implement Tree 3 (predictive) in `src/trees/tree3-predictive.ts`: cap the tree at Probable under all inputs — Established is unreachable; when `meetsEstablishedShapedConditions` is true, return Probable with a capping condition stating Established is unavailable on this tree (FR-028) (depends on T043, T034)
- [x] T046 [US4] Implement Tree 4 (complex-system) in `src/trees/tree4-complex-system.ts`: for the decomposable branch, route `subClaimIds` to their own trees and report any uncaptured residue; for the irreducible branch, return Unresolvable populated from `whyNoHonestBand` and `evidenceThatWouldChangeIt` (FR-029) (depends on T043, T034)
- [x] T047 [US4] Implement dual-tree routing in `src/index.ts`'s `evaluate()`: when `classification.confidence === 'low'` and `classification.alternative` is set, run both matching trees and report the lower band with both results shown (FR-030) (depends on T044, T045, T046)
- [x] T048 [US4] Wire Trees 2–4 into `evaluate()` in `src/index.ts` for their respective `classification.primary` values (depends on T047)
- [x] T049 [P] [US4] Write hand-worked fixture cases for Trees 2–4 in `tests/fixtures/cases/` covering all 7 of spec.md's User Story 4 acceptance scenarios (depends on T048)

**Checkpoint**: All four trees are independently functional. Re-running the Phase 5 suite now shows full four-tree band-outcome coverage.

---

## Phase 7: User Story 5 - Aggregate a compound claim from its sub-claims (Priority: P3)

**Goal**: A compound claim's band derives from its sub-claims' bands by fixed rules, recomputed
at zero API cost whenever any sub-claim band changes.

**Independent Test**: spec.md's 5 acceptance scenarios for User Story 5 (minimum-of-load-bearing;
supplementary sub-claims never raise the band; Unresolvable propagation; recompute names the
moved sub-claim; multiple independent clusters on a single claim are unaffected by aggregation
rules).

### Implementation for User Story 5

- [x] T050 [US5] Define `CompoundInput` type in `src/schema/ledger.ts` per data-model.md, including the `edges` field used only for cycle detection (depends on T009)
- [x] T051 [US5] Implement cycle detection in `src/aggregate/compound.ts`: refuse via `makeRefusal()` rather than recurse when `CompoundInput.edges` contains a cycle (FR-040) (depends on T050, T011)
- [x] T052 [US5] Implement minimum-of-load-bearing aggregation in `src/aggregate/compound.ts`: compound band = minimum across load-bearing sub-claims; any load-bearing sub-claim banded Unresolvable makes the compound Unresolvable immediately, without evaluating the rest (FR-035, FR-038) (depends on T051)
- [x] T053 [US5] Implement supplementary sub-claim handling in `src/aggregate/compound.ts`: supplementary sub-claims never raise the compound band (FR-036); **two or more** independently failing supplementary sub-claims lower it by exactly one step, per the accepted clarification on FR-037 (depends on T052)
- [x] T054 [US5] Implement `aggregate(input, previous?)` in `src/aggregate/compound.ts` per contracts/engine-api.md: when `previous` is supplied and exactly one sub-claim's band differs, set `movedBy` to that sub-claim's id; perform no re-evaluation of evidence in any case (FR-039) (depends on T053)
- [x] T055 [US5] Implement the multi-cluster carve-out in `src/aggregate/compound.ts`: aggregation rules MUST NOT reduce the band reachable by a single claim supported by several independent evidence clusters, since converging clusters are counted during normalization (T021–T023) and are never sub-claims (FR-041) (depends on T054)
- [x] T056 [US5] Export `aggregate()` from `src/index.ts` matching contracts/engine-api.md's full signature (depends on T055)
- [x] T057 [P] [US5] Write hand-worked fixture cases for aggregation in `tests/fixtures/cases/` covering all 5 of spec.md's User Story 5 acceptance scenarios (depends on T056)

**Checkpoint**: Every user story in spec.md is independently functional. The Phase 5 suite now exercises the full coverage FR-049 and SC-003 require.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T058 [P] Run the full quickstart.md validation sequence end-to-end (fixture suite, offline run, determinism diff, one-fixture-case manual review against AGENT-PROTOCOL-v3.md) and record the results
- [x] T059 [P] Add a `README.md` at the repo root documenting the `evaluate()`/`aggregate()` contract for a forker landing on the repo cold, linking to `contracts/engine-api.md` rather than duplicating it
- [x] T060 Re-run the Constitution Check gate from `plan.md` against the finished implementation and update its Post-Phase-1 re-check note with the result
- [x] T061 [P] Confirm SC-002 (100% fixture pass), SC-005 (100% below-ceiling verdicts carry a capping condition), SC-006 (0 verdicts contain a numeric score anywhere), SC-007 (100% conditions map to a protocol clause), and SC-009 (100% inconsistent-ledger refusals name the offending input) directly from suite output, not by inspection alone

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup. **Blocks all user stories.**
- **User Story 1 (Phase 3)**: Depends on Foundational only.
- **User Story 2 (Phase 4)**: Depends on Foundational **and** User Story 1 (Tree 1 reads normalized output — T027/T031 depend on T026).
- **User Story 3 (Phase 5)**: Depends on User Story 2 (needs at least one tree and verdict assembly to have fixtures to run — T037 depends on T036).
- **User Story 4 (Phase 6)**: Depends on User Story 2 (reuses `verdict/assemble.ts` from T034) but is otherwise independent of US3/US5.
- **User Story 5 (Phase 7)**: Depends on Foundational (T009) and the refusal convention (T011) only — does not depend on any tree, since it aggregates already-computed sub-claim bands.
- **Polish (Phase 8)**: Depends on all desired user stories being complete.

### Parallel Opportunities

- All `[P]` tasks in Setup (T003–T005) run in parallel.
- Within Foundational, T003/T004/T005 (Setup) and T010/T011 (after T008/T009) can overlap with type-definition work.
- Within US1, `weight.ts` (T014–T020), `clusters.ts` (T021–T023), and `diagnosticity.ts` (T024–T025) touch different files and can be built in parallel by different people, converging only at T026.
- **User Story 5 has no dependency on Trees 1–4 or on User Stories 1–3** and can be staffed in parallel with Phase 4–6 once Phase 2 is done, despite its P3 priority — priority here reflects value ordering, not a build blocker.
- Fixture-writing tasks (T036, T049, T057) are `[P]` against everything except the tree code they cover, since each is a self-contained new file under `tests/fixtures/cases/`.

---

## Parallel Example: User Story 1

```bash
# Three engineers, three files, converging at T026:
Task: "Implement zero-weight/trigger/interested-party/reliability rules in src/normalize/weight.ts (T014-T020)"
Task: "Implement cluster partitioning and grading in src/normalize/clusters.ts (T021-T023)"
Task: "Implement non-diagnostic exclusion and rival marking in src/normalize/diagnosticity.ts (T024-T025)"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2 + 3)

Spec.md is explicit that these three P1 stories are the smallest slice delivering the project's
core promise (User Story 4's rationale: "Tree 1 alone is a viable slice, so this follows rather
than blocks it"). MVP = Phases 1–5:

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1 — normalization).
3. Complete Phase 4 (US2 — Tree 1 + verdict assembly).
4. Complete Phase 5 (US3 — the fixture suite proving it).
5. **STOP and VALIDATE**: run quickstart.md in full against Tree 1 alone before adding Trees 2–4.

### Incremental Delivery After MVP

6. Add Phase 6 (US4 — Trees 2–4) → suite coverage extends to all four trees automatically.
7. Add Phase 7 (US5 — aggregation) → can be built any time after Phase 2, in parallel with 6 if staffed.
8. Phase 8 (Polish) once every story planned for this release is in.

---

## Notes

- `[P]` tasks touch different files with no unmet dependency.
- Every constraint copied into a task description above (enum values, exact thresholds like "exactly two clusters," the FR-031/034/037 clarified rules) is copied verbatim from data-model.md or spec.md — implementers should not need to re-derive them from AGENT-PROTOCOL-v3.md.
- The fixture suite (Phase 5) is never "done" until Phase 6 and 7 land — it re-validates cumulatively, per the Phase 5 checkpoint note.
- Per the constitution's Development Workflow section, any change to `src/trees/`, `src/normalize/`, or `src/aggregate/` after this initial build goes through methodology review, not ordinary code review.
