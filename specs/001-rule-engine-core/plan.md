# Implementation Plan: Deterministic Rule Engine, Core Schema, and Fixture Suite

**Branch**: `main` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-rule-engine-core/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Build the deterministic core of the GroundTruth Execution Platform: a typed ledger/verdict
schema, the four decision trees (simple-factual, causal, predictive, complex-system), ledger
normalization (zero-weight rule, cluster partitioning, non-diagnostic exclusion), compound-claim
aggregation, and a hand-worked fixture suite proving the engine reproduces the protocol's bands —
all with zero network access, zero model calls, and zero monetary cost. Technical approach: a
single dependency-free TypeScript package, runtime-validated with Zod at the ledger boundary,
tested with Vitest, importable by the future orchestration pipeline without modification.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS

**Primary Dependencies**: None at runtime beyond the language's standard library (FR-005 requires
zero network/model access, which a dependency-free core makes structurally easier to audit); Zod
for runtime ledger validation at the schema boundary (see research.md). Dev-only: TypeScript
compiler, Vitest.

**Storage**: N/A — persistence is explicitly out of scope for this feature (spec Assumptions: "The
database, migrations, and stored-run format are a separate feature")

**Testing**: Vitest

**Target Platform**: Node.js 20+ LTS, cross-platform (Linux/macOS/Windows dev machines and CI
runners). No browser target: the project's transparency goal is served by the repo being open
source and forkable, not by in-browser re-execution, so no WASM/bundle-size constraint applies.

**Project Type**: Single library/package — an internal computation module with no UI, consumed by
a future orchestration-pipeline feature via a single exported function.

**Performance Goals**: Full fixture suite completes in under 60 seconds on a developer machine
(SC-008). No latency/throughput target beyond that: the engine is a synchronous pure function, not
a live service.

**Constraints**: Zero network calls, zero model calls, zero monetary cost, verifiable with no
credentials configured (FR-005, SC-001). Deterministic output — identical ledger input MUST
produce byte-identical verdict output on every run (FR-006, SC-004). Ledger free-text fields MUST
NOT be interpreted as instructions under any circumstance (FR-007).

**Scale/Scope**: Single-claim ledger evaluation per call. The fixture suite MUST exercise every
band outcome of every tree, the normalization rules, the aggregation rules, and each refusal case
(FR-049, SC-003) — scope is outcome coverage, not data volume.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Basis |
|---|---|---|
| I. Deterministic Verdicts | **PASS** | Band computed entirely by code from a typed ledger; no model call anywhere in the path (FR-005, FR-021). Engine emits tree used, conditions met, and capping conditions on every run (FR-042). No numeric score or percentage anywhere (FR-044). |
| II. Blind and Mirrored Judgment | **N/A** | Governs the judgment skills that populate the ledger (origin grading, warrant assignment). Explicitly out of scope here — spec Assumptions: "Judgments arrive already made." Nothing in this feature grades evidence or sees claim direction. |
| III. Full Trace, Public and Contestable | **PARTIAL (scoped, not violated)** | This feature emits the trace *content* every verdict needs — tree used, met/capping conditions, engine/schema version stamps (FR-042, FR-045, FR-046). The public/persistent/contestable surface (challenge mechanism, run_id, requester, stability record) depends on the future persistence and site features, consistent with the constitution's own phasing note ("Hosting stays at the phase it needs"). |
| IV. The Schema Is the Contract | **PASS** | Typed core schema with per-tree extension blocks (FR-001), its own version identifier distinct from engine/protocol version (FR-002), judgment-vs-computed field distinction enforced at the type level and refused at runtime on conflict (FR-003). |
| V. Fetched Content Is Data, Never Instruction | **PASS** | Engine never accepts, requests, or acts on free-text instruction from the ledger (FR-007); ledger text fields are carried through to verdict output as data only, never as control flow. |
| VI. Harm Gate Before Spend | **N/A** | This feature makes zero API calls of any kind, so there is no spend to gate. Claim-intake classification is a separate future feature. |
| Architecture and Cost Constraints (single store, DAG, recursion bounds) | **N/A** | Persistence and the claim graph are explicitly out of scope (spec Assumptions). Nothing here conflicts with the eventual single-Postgres-store design. |
| Development Workflow — fixture suite as merge gate | **PASS** | This feature builds exactly that suite: hand-worked cases from the protocol, zero API calls, required to pass before any engine change merges (FR-047–FR-051). |

**Result**: Gate passes. One principle (III) is partially served by design, with the remainder
explicitly deferred to features this spec's Assumptions already name as separate — not an
unjustified gap. No Complexity Tracking entries required.

**Post-Phase-1 re-check**: data-model.md and contracts/engine-api.md introduce nothing that
changes this table. The `LedgerInput`/`Verdict` type split and Zod boundary (research.md §1, §3)
strengthen Principle IV rather than complicate it; `aggregate()`'s optional `previous` argument
(contracts/engine-api.md) keeps the function pure — it is an explicit input, not hidden state —
so Principle I's determinism guarantee is unaffected. Gate still passes.

**Post-implementation re-check (T060)**: two refinements emerged during implementation that
data-model.md did not anticipate, both documented in-code and in data-model.md at the time:
`Warrant.channelKeys` (clustering was uncomputable without a per-channel identifier — FR-016) and
`TreeResult.band: Band | null` (Tree 4's decomposable branch routes to sub-claim trees rather than
computing a band itself — FR-029). Neither touches a constitution principle: `channelKeys` is
judgment data the ledger already implies, not a new computed field, so Principle IV's
judgment/computed split is unaffected; the nullable band is exempted from FR-043's
capping-condition requirement in `verdict/assemble.ts` specifically because it represents "no band
computed here," not "a band capped below ceiling." Manually cross-checked three fixture verdicts
(Tree 1 Established, Refuted, and Tree 3's Probable ceiling) against AGENT-PROTOCOL-v3.md's actual
tree text directly — all three match the protocol's wording exactly (quickstart.md's SC-010
check). Gate still passes; no unjustified complexity introduced.

**T061 caught a real defect**: `aggregate/compound.ts` originally built its `Verdict` directly
instead of routing through `verdict/assemble.ts`, so FR-043's "below-ceiling band must carry a
capping condition" requirement silently didn't apply to any aggregation verdict — 4 of 19 fixture
verdicts had empty `cappingConditions` despite being below the `'established'` ceiling. This
would not have been caught by the fixture suite's own band/tree assertions (they don't check
`cappingConditions`), only by SC-005's direct check. Fixed by having `evaluateAggregate()` return
a `TreeResult` and call `assembleVerdict('aggregation', ...)` like every other tree, which also
let it drop its own duplicate qualifier/version-stamping logic. Re-verified SC-002 (19/19), SC-005
(0 missing), SC-006 (0 numeric values), SC-007 (0 conditions without a protocol clause), and
SC-009 (refusal names the offending input) directly against engine output after the fix.

## Project Structure

### Documentation (this feature)

```text
specs/001-rule-engine-core/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── engine-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── schema/
│   ├── ledger.ts          # Typed Ledger/Verdict schema + per-tree extension blocks (FR-001, FR-002)
│   └── validate.ts         # Runtime validation; judgment-vs-computed field guard (FR-003, FR-004)
├── normalize/
│   ├── weight.ts            # Zero-weight rule, interested-party table, reliability interaction (FR-009, FR-014, FR-015)
│   ├── clusters.ts          # Dependency partitioning, cluster grading (FR-016, FR-017, FR-020)
│   └── diagnosticity.ts     # Non-diagnostic exclusion, rival rebuttal marking (FR-018, FR-019)
├── trees/
│   ├── tree1-simple-factual.ts
│   ├── tree2-causal.ts
│   ├── tree3-predictive.ts
│   └── tree4-complex-system.ts
├── aggregate/
│   └── compound.ts           # Minimum-of-load-bearing, one-step demotion, cycle refusal (FR-035–FR-041)
├── verdict/
│   └── assemble.ts            # Trace assembly, version stamps, capping-condition mapping (FR-042–FR-046)
└── index.ts                    # Single exported evaluate(ledger) entry point

tests/
├── fixtures/
│   └── cases/                  # Hand-worked ledger + expected-band pairs (FR-047)
├── unit/                        # Per-module tests: normalize/, trees/, aggregate/
└── suite/
    └── run-fixtures.test.ts     # The fixture-suite runner (FR-049–FR-051, SC-002, SC-003, SC-008)
```

**Structure Decision**: Option 1 (single project/library), no frontend/backend split. This feature
ships as one dependency-free TypeScript package with a single entry point (`src/index.ts`) that a
future orchestration-pipeline feature imports and calls — it is not itself a service, has no API
surface beyond that function, and needs no separate deployment target.

## Complexity Tracking

*No entries — Constitution Check passed without requiring any justified exception.*
