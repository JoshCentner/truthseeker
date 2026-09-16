---

description: "Task list for 005-claim-corpus-report"
---

# Tasks: Claim Corpus Structure and Visual Claim Report

**Input**: Design documents from `/specs/005-claim-corpus-report/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included. The constitution makes the fixture suite the correctness foundation and requires
it to run with zero API calls, and several success criteria (SC-003a, SC-006, SC-007, SC-010) are
only meaningfully verifiable as tests.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 (report page, P1), US2 (relationships, P2), US3 (offline regeneration, P3)

## Path Conventions

Per [plan.md](./plan.md): new source in `src-corpus/`, tests in `src-corpus/tests/`, corpus data in
`corpus/claims/`, build output in `dist-site/` (gitignored).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Directory structure and build wiring

- [X] T001 Create `src-corpus/` and `src-corpus/tests/fixtures/` directory structure per plan.md
- [X] T002 Add `dist-site/` to `.gitignore` alongside the existing `dist-ui/` entry
- [X] T003 [P] Add `corpus:report` script to `package.json` invoking `tsx src-corpus/cli.ts`
- [X] T004 [P] Confirm `vitest.config.ts` picks up `src-corpus/tests/**/*.test.ts`; extend the include glob if it does not

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The reading, validation and escaping layer every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Escaping and HTML construction

- [X] T005 Implement HTML escaping primitives in `src-corpus/html.ts`: escape `&`, `<`, `>`, `"`, `'` in text; a separate attribute-value escaper; and an `el(tag, attrs, children)` constructor that accepts ONLY an allowlisted tag name and pre-escaped children, per research.md §2
- [X] T006 [P] Implement URL safety in `src-corpus/html.ts`: a link is rendered clickable only when its scheme is `http` or `https` (FR-027c); every other scheme, including `javascript:` and `data:`, renders as inert escaped text
- [X] T007 [P] Write escaping unit tests in `src-corpus/tests/html.test.ts` covering text escaping, attribute escaping, rejection of non-allowlisted tag names, and the `http`/`https`-only link rule

### Frontmatter and claim record

- [X] T008 Implement the restricted frontmatter parser in `src-corpus/frontmatter.ts` supporting exactly three forms per contracts/claim-record.md: `key: value` scalars taken as literal strings with no type coercion, `key: |` block scalars, and `key:` followed by indented `- item` lists; every other construct is an error naming file and line
- [X] T009 [P] Write frontmatter tests in `src-corpus/tests/frontmatter.test.ts` asserting no type coercion occurs — `edgeType: no` stays the string `"no"`, `parentClaim: 1.20` stays `"1.20"` — and that nested maps, inline arrays, anchors, tags and comments each error with a line number
- [X] T010 Define the claim record zod schema in `src-corpus/claim-record.ts` with fields per data-model.md: `corpusSchemaVersion` (string, required), `canonicalRestatement` (string, required iff `claimKind` is `"claim"`, forbidden iff `"rejection"`), `claimKind` (`"claim"` | `"rejection"`, required), `parentClaim` (claim id, optional), `edgeType` (`"load_bearing"` | `"supplementary"`, required iff `parentClaim` present), `supersedes` (claim id, optional), `supersedesConfirmedBy` (string, required iff `supersedes` present), `aliases` (string[], optional)
- [X] T011 Implement forbidden-field rejection in `src-corpus/claim-record.ts`: `band`, `qualifier`, `verdict`, `tree`, `conditionsMet`, `cappingConditions`, `engineVersion`, `schemaVersion` each fail the read naming file and field (FR-012), and any unknown field fails likewise — never silently ignored
- [X] T012 [P] Write claim-record validation tests in `src-corpus/tests/claim-record.test.ts` covering each rule in the contracts/claim-record.md enforcement table, including that `band: established` in frontmatter fails rather than being dropped (SC-006)

### Identity

- [X] T013 Implement claim id derivation in `src-corpus/identity.ts` per contracts/claim-record.md: lowercase, collapse each run of non-alphanumerics to a single hyphen, trim hyphens, truncate the readable part to 48 characters at a hyphen boundary, then append a hyphen and the first 8 hex characters of the SHA-256 of the full untruncated untransformed restatement
- [X] T014 [P] Implement the rejection id form in `src-corpus/identity.ts`: `rejected-` plus 16 hex characters derived from the run id, with no restatement contributing to the name, per research.md §6
- [X] T015 [P] Write identity tests in `src-corpus/tests/identity.test.ts` covering byte-identical restatements producing identical ids (FR-007), distinct restatements never colliding, and graceful degradation for long, non-Latin and punctuation-only restatements

### Corpus reading

- [X] T016 Implement single-claim reading in `src-corpus/corpus.ts`: locate a claim directory, parse `claim.md`, collect supplementary `*.md` in filename order, and load every file under `runs/`
- [X] T017 Implement run-record loading in `src-corpus/run-records.ts` handling both shapes from data-model.md — with a verdict (`result.kind === "completed"`), and without one (`rejected`, `needs_review`, `needs_clarification`) — and rejecting any record whose `result.kind` is `"auth_failed"` as unstorable (FR-009b)
- [X] T018 Implement identity verification in `src-corpus/corpus.ts`: the directory name must equal the id derived from `canonicalRestatement` (FR-008), and every run record's stored claim text must equal `canonicalRestatement` (FR-007d); either mismatch fails the read showing both values
- [X] T019 Implement nesting rejection in `src-corpus/corpus.ts`: a claim directory containing another claim directory fails the read (FR-002)
- [X] T020 [P] Write corpus-reading tests in `src-corpus/tests/corpus.test.ts` covering a valid claim, a claim with supplementary files, a nested-directory corpus, an `auth_failed` record, and a restatement edited after a run exists (SC-007a)

### Corpus migration

- [X] T021 Write the migration script `tools/migrate-corpus.mts` moving each existing `corpus/runs/*.json` into `corpus/claims/<derived-id>/runs/<run-id>.json` and generating the matching `claim.md` from the record's own `claimRestatement`
- [X] T022 Run the migration against the two existing records and verify each derived directory id matches its restatement under T013's rule
- [X] T023 [P] Update `corpus/README.md` to describe the claim-folder layout, the authored-versus-generated split, and the fact that a band is never hand-authorable

**Checkpoint**: Corpus reads, validates and refuses bad input. User story work can begin.

---

## Phase 3: User Story 1 - A skeptical reader judges a verdict for themselves (Priority: P1) 🎯 MVP

**Goal**: One claim directory renders to a single self-contained HTML page carrying the band, the
evidence, the rivals, the engine's conditions, the full process trace and the provenance.

**Independent Test**: Render the migrated Great Wall claim and hand the page to someone who has not
seen the project; they can state the band, its meaning, one source and one counterpoint in two
minutes without asking a question (SC-001).

### Tests for User Story 1

- [X] T024 [P] [US1] Write the hostile fixture corpus in `src-corpus/tests/fixtures/hostile/` whose authored Markdown and run-record strings both contain `<script>` tags, `onerror=` attributes and `javascript:` URLs
- [X] T025 [P] [US1] Write injection tests in `src-corpus/tests/injection.test.ts` asserting the rendered page contains no `<script`, no `on*=` attribute, no non-`http(s)` `href`, and no external resource reference (SC-003a)
- [X] T026 [P] [US1] Write vocabulary-coverage test in `src-corpus/tests/vocabulary.test.ts` asserting every protocol term rendered on a page has a glossary entry and that a term without one is a generation error, not a bare identifier (SC-001c)
- [X] T027 [P] [US1] Write render tests in `src-corpus/tests/render-claim.test.ts` asserting no numeric score appears (SC-003), every ledger origin appears with URL and retrieval status including unretrieved ones (SC-002, FR-027), and every remediation attempt including failures appears (SC-004)

### Implementation for User Story 1

- [X] T028 [P] [US1] Implement the restricted Markdown renderer in `src-corpus/markdown.ts` on top of `html.ts`, supporting exactly: ATX headings levels 2–4, paragraphs, emphasis, strong emphasis, ordered and unordered lists, inline code, fenced code blocks, block quotes and inline links
- [X] T029 [US1] Implement out-of-subset handling in `src-corpus/markdown.ts`: raw HTML is stripped (FR-027a), and tables, images, footnotes, reference links and autolinks render as literal escaped text so a contributor sees they did not take effect
- [X] T030 [P] [US1] Populate `src-corpus/vocabulary.ts` with one entry per protocol term — every band, warrant grade, reliability grade, diagnosticity mark, edge type, trigger direction and engine condition id — each carrying `term`, `plain` and `definition` per data-model.md
- [X] T031 [US1] Implement `DisplayedVerdict` derivation in `src-corpus/run-records.ts` per data-model.md: `recordedBand` and `recordedEngineVersion` from the record, `currentBand` from `evaluate(ledger)` at generation time, and `drift` of `"none"` | `"superseded"` | `"uncheckable"` (FR-031, FR-032, FR-033)
- [X] T032 [US1] Implement the page shell and inlined CSS in `src-corpus/page-style.ts` with no external font, stylesheet or script reference, readable at 400px width (FR-026, FR-027d)
- [X] T033 [US1] Implement the verdict section in `src-corpus/render-claim.ts`: band with its definition inline (FR-014), engine version, and both bands shown when `drift` is `"superseded"` (FR-032); no numeric score anywhere (FR-015)
- [X] T034 [US1] Implement the provenance section in `src-corpus/render-claim.ts` showing run id, requester, model ids, engine and schema versions, timestamps, the record's provenance block with any blindness caveat visible without interaction (FR-022, SC-005), and an explicit statement of which constitutionally-required stamps the record does not carry (research.md §7)
- [X] T035 [US1] Implement the evidence ledger section in `src-corpus/render-claim.ts` listing every origin with URL, retrieval status, warrant grade, reliability grade and fired triggers with their mechanisms, grouped into supporting, opposing and neither by diagnosticity mark (FR-016, FR-017, FR-027)
- [X] T036 [US1] Implement the rivals section in `src-corpus/render-claim.ts` with description, rebutted state and plausibility relative to the claim (FR-018)
- [X] T037 [US1] Implement the engine-conditions section in `src-corpus/render-claim.ts` listing conditions met and capping conditions separately, each with its recorded clause (FR-019)
- [X] T038 [US1] Implement the process-trace section in `src-corpus/render-claim.ts` showing steps in order, sources pulled, and every remediation attempt including failures with the violation each reported (FR-020); it sits above the glossary in document order and is never behind an interaction
- [X] T039 [US1] Implement the authored-notes section in `src-corpus/render-claim.ts` rendering the claim record's prose and supplementary files, visually distinguished from generated content (FR-013)
- [X] T040 [US1] Implement the glossary section in `src-corpus/render-claim.ts` covering every protocol term appearing on that page (FR-015b), with plain-language wording drawn from the single shared source so no term is worded two ways (FR-015a, FR-015c)
- [X] T041 [US1] Implement non-verdict rendering in `src-corpus/render-claim.ts`: where the displayed run ended without a verdict, replace the verdict, stability, ledger, rivals and conditions sections with one outcome section stating the rule that fired, the reason queued, or the step that exhausted its attempts and the questions raised (FR-013a)
- [X] T042 [US1] Implement harm-gate rejection rendering in `src-corpus/render-claim.ts`: publish the rule that fired, the run id and the date, and never the claim text (FR-013b, research.md §6)
- [X] T043 [US1] Implement the CLI in `src-corpus/cli.ts` per contracts/generator-cli.md with `<claim-id>`, `--out` defaulting to `dist-site`, `--corpus` defaulting to `corpus`, and `--check`; exit codes 0 generated, 1 claim not found, 2 validation failed, 3 no run record, 4 usage error
- [X] T044 [US1] Generate the real Great Wall page and verify by hand against quickstart.md Part 2 — readability, weighting explicability, process-view usability, blindness-caveat prominence, drift legibility

**Checkpoint**: One claim renders completely and safely. This is the MVP.

---

## Phase 4: User Story 2 - A contributor records a sub-claim and its relationship (Priority: P2)

**Goal**: Claims and sub-claims are siblings on disk with relationships declared upward in
frontmatter, resolved and validated as a DAG, and rendered as navigable links.

**Independent Test**: Add a sub-claim folder declaring a parent, regenerate, confirm it is a sibling
directory whose relationship resolves; then point it at a missing claim and separately create a
cycle, and confirm each fails loudly.

### Tests for User Story 2

- [X] T045 [P] [US2] Write graph fixtures in `src-corpus/tests/fixtures/graph/` covering a valid parent/sub-claim pair, a dangling parent reference, a two-claim cycle, a self-referencing claim, and a supersedes chain
- [X] T046 [P] [US2] Write graph tests in `src-corpus/tests/graph.test.ts` asserting a cycle fails naming every participant rather than just the first (SC-007), a dangling reference fails naming the missing claim (FR-011), and a self-reference is treated as a cycle of length one

### Implementation for User Story 2

- [X] T047 [US2] Implement relationship resolution in `src-corpus/graph.ts` reading `parentClaim`, `edgeType` and `supersedes` from every claim record in the corpus and building the edge set
- [X] T048 [US2] Implement DAG validation in `src-corpus/graph.ts` over the union of all edge types, failing the read and naming every claim in a cycle (FR-010)
- [X] T049 [US2] Implement reference validation in `src-corpus/graph.ts`: `parentClaim` and `supersedes` must resolve to existing claim directories, failing the read naming the missing claim (FR-011)
- [X] T050 [US2] Enforce the edge-type split in `src-corpus/claim-record.ts`: `edgeType` accepts only `load_bearing` and `supplementary` and applies only to sub-claim edges; `supersedes` is a distinct relation and must not be usable where a sub-claim edge type is expected (FR-006)
- [X] T051 [US2] Implement the relationships section in `src-corpus/render-claim.ts` rendering parent, sub-claims and supersedes links with edge type stated (FR-023, SC-008)
- [X] T052 [US2] Implement bidirectional supersedes rendering in `src-corpus/render-claim.ts`: a superseded claim links forward to its replacement and the replacement links back, and the superseded claim's page stays published with evidence and verdict intact (FR-007c, SC-007b)
- [X] T053 [US2] Wire whole-corpus validation into `src-corpus/cli.ts` so identity, reference and DAG checks always run across the whole corpus even when rendering a single claim, per contracts/generator-cli.md

**Checkpoint**: The graph half works and refuses malformed input. US1 still passes.

---

## Phase 5: User Story 3 - A contributor regenerates from a fresh clone (Priority: P3)

**Goal**: Generation is offline, keyless and byte-deterministic.

**Independent Test**: Disable networking, regenerate, and diff against the previous output.

### Tests for User Story 3

- [X] T054 [P] [US3] Write determinism tests in `src-corpus/tests/determinism.test.ts` rendering a fixture corpus twice and asserting byte-identical output apart from the single stamped generation timestamp (SC-010)
- [X] T055 [P] [US3] Write an offline test in `src-corpus/tests/offline.test.ts` stubbing `globalThis.fetch` to throw, asserting generation completes and no key is read from the environment (SC-009, FR-028)

### Implementation for User Story 3

- [X] T056 [US3] Enforce deterministic ordering across `src-corpus/render-claim.ts` and `src-corpus/corpus.ts`: sort every collection by an explicit key, never emit output in object-key or filesystem-read order, per research.md §8
- [X] T057 [US3] Implement fixed-format UTC date rendering in `src-corpus/render-claim.ts` so no output varies by locale or timezone
- [X] T058 [US3] Emit exactly one generation timestamp in `src-corpus/render-claim.ts`, in one place, explicitly labelled as generation time and distinguished from any run timestamp (FR-030)

**Checkpoint**: Output is reproducible and the offline guarantee is tested rather than asserted.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T059 Implement the stability record in `src-corpus/render-claim.ts` beside the band, listing every run with date, engine version and band, with the evidence-base fingerprint computed as the sorted set of `(originId, retrievalStatus, retracted)` triples (FR-029, FR-029b)
- [X] T060 Implement disagreement surfacing in `src-corpus/render-claim.ts`: where any run sharing the displayed run's fingerprint recorded a different band, show that at the band itself rather than leaving it to be inferred from the stability list (FR-029a, SC-011)
- [X] T061 [P] Run the full suite and confirm the existing 151 tests still pass alongside the new ones
- [X] T062 [P] Run `npx tsc -p tsconfig.json --noEmit` and `npx eslint src src-corpus` clean
- [X] T063 Run quickstart.md Parts 1–4 end to end, including deliberately breaking the graph to confirm failures are loud and specific
- [X] T064 Add a PROJECT-TRACKER.md entry for the `protocol_version` / `registry_version` stamping gap, which `003` must close and this feature can only report

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational. Independently deliverable as the MVP
- **US2 (Phase 4)**: Depends on Foundational. Does not depend on US1, though T051/T052 render into the page US1 builds
- **US3 (Phase 5)**: Depends on Foundational; meaningfully testable once US1 renders
- **Polish (Phase 6)**: Depends on US1; T059/T060 extend US1's verdict section

### Within Foundational

`html.ts` (T005–T007) blocks `markdown.ts`. `frontmatter.ts` (T008) blocks `claim-record.ts` (T010).
`identity.ts` (T013) blocks corpus identity verification (T018). Migration (T021–T022) needs the
identity rule from T013.

### Parallel Opportunities

- T003, T004 in Setup
- T006, T007 after T005; T009 after T008; T012 after T011; T014, T015 after T013
- All four US1 test tasks (T024–T027) together
- T028 and T030 together, being different files
- Both US2 test tasks (T045, T046) together
- Both US3 test tasks (T054, T055) together
- US2 and US3 can proceed in parallel with each other once Foundational is done

## Parallel Example: User Story 1

```bash
# The four test tasks are independent files:
Task: "Hostile fixture corpus in src-corpus/tests/fixtures/hostile/"
Task: "Injection tests in src-corpus/tests/injection.test.ts"
Task: "Vocabulary coverage test in src-corpus/tests/vocabulary.test.ts"
Task: "Render tests in src-corpus/tests/render-claim.test.ts"

# Then two implementation files with no dependency between them:
Task: "Restricted Markdown renderer in src-corpus/markdown.ts"
Task: "Vocabulary entries in src-corpus/vocabulary.ts"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 US1 → **STOP and validate against
quickstart.md Part 2 with a real reader.** The spec chose design-first deliberately: if the page
does not read well, generalising it to a whole corpus multiplies the problem rather than revealing
it.

### Incremental Delivery

Setup + Foundational → US1 (MVP, one page reads well) → US2 (the graph) → US3 (reproducibility) →
Polish (stability record). Each increment leaves the previous one working.

## Notes

- **Do not let the renderer acquire band logic.** It renders what a record stores and compares
  against `evaluate()`. Any code in `src-corpus/` that decides a band is a Principle I violation,
  regardless of how convenient it seems.
- **Escaping is not a step, it is the boundary.** Every string crosses through `html.ts`. A task
  that formats a value into markup without going through it has reintroduced the whole class of bug
  research.md §2 exists to close.
- **Failures must name the file.** Every validation error in this feature is read by a contributor
  who cannot see the code. "Invalid claim record" is not an acceptable message.
- Commit after each task or logical group.
