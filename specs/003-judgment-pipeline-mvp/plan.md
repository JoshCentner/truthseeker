# Implementation Plan: Judgment Pipeline MVP

**Branch**: `main` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-judgment-pipeline-mvp/spec.md`

## Summary

A Node.js pipeline that turns a raw claim into a `LedgerInput` `001`'s engine accepts: a harm gate
(reject / accept / needs-human-review) runs before any spend; an autonomous web-search step (via
the model provider's own search-grounding tool, not model memory) finds and retrieves real
sources; each retrieved origin is graded blind to the claim; diagnosticity is marked against the
claim and any identified rivals; a small seed structural registry prevents aggregators being
graded as original sources. Built with a swappable LLM-client interface so the entire
orchestration is unit-testable against a mock client — this plan does not assume live API access
is available in every environment that runs this feature's tests.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+ LTS — same as `001`/`002`.

**Primary Dependencies**: `@google/genai` (the current official Gemini SDK — `@google/generative-
ai` is now legacy), pinned below 3.0.0 since that major version raises the Node requirement to 22+
and this repo targets 20+. Reuses `001`'s `zod` for validating the pipeline's own output against
`LedgerInput` before handing it to `evaluate()`. No new dependency for the structural registry — a
seed list ships as static, versioned TypeScript data (FR-039), not a database table.

**Storage**: N/A for run history and fetch archives, matching `001`'s and `002`'s precedent — this
plan writes them to local files for now (see research.md §4), not a database, since standing up
Postgres/Neon is explicitly out of scope per spec.md's Assumptions. The one exception spec.md
carves out is the "needs human review" queue (FR-002a): also a local append-only file for this
MVP, since it needs to survive the process exiting but does not need a database to do that.

**Testing**: Vitest (existing). A `MockLlmClient` implementing the same interface as the real
Gemini client stands in for every automated test — this feature's test suite makes zero live API
calls and needs no API key to run. Live behavior (does the search grounding actually find good
sources, is the model's grading actually sound) is validated by a human running quickstart.md with
their own key, not by this feature's automated suite.

**Target Platform**: Node.js server-side/CLI process only — **never a browser context**. This is
a hard constraint, not a preference: an API key embedded in browser-shipped JavaScript is visible
to anyone who opens devtools or inspects network requests, which is exactly the key-exposure
`002`'s BYOK requirement and FR-008/FR-009 are trying to prevent. `002`'s Vite-bundled UI MUST NOT
import this feature's code directly; if `002` ever triggers a `003` run, it would call a local
server process, not embed the Gemini client in the browser bundle.

**Project Type**: A Node.js library (`src-pipeline/`, mirroring `001`'s `src/` naming but kept
separate — see Project Structure) exposing one entry point, plus a thin CLI so the pipeline is
actually runnable without writing a throwaway script each time (spec.md Assumptions leaves the
"how it's exposed" choice to this plan; a library + CLI is the smallest thing that's both testable
and genuinely usable today).

**Performance Goals**: No sub-second or sub-minute target — real multi-step LLM orchestration with
real web retrieval takes real wall-clock time (plausibly low minutes per claim). The goal is that
the pipeline reports progress per step (so a multi-minute run doesn't look hung) rather than
completing within any specific budget.

**Constraints**: The harm gate (FR-001–FR-002a) MUST complete, and reach accept/reject/review,
before any other API call is made — this is checked structurally in code (the harm-gate call
happens first and every other function requires its accept result as an input), not just by
convention. The supplied key is held only in memory for the run's duration (FR-008/FR-009) — never
written to the local files used for fetch archives or the review queue.

**Scale/Scope**: One claim per invocation for this MVP — no batch/queue processing beyond the
single review-queue file (FR-002a).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Basis |
|---|---|---|
| I. Deterministic Verdicts | **N/A for this feature's own steps** | This feature produces the *input* to the engine, not a band — its LLM calls are not required to be deterministic themselves (that would misunderstand where Principle I applies). What it MUST do, and does (FR-033), is never approximate or duplicate the engine's own banding logic; the engine alone computes the verdict. |
| II. Blind and Mirrored Judgment | **PASS** | This is this feature's central architectural commitment: FR-020 draws the exact line (grading receives origin + signalling questions only), FR-027 draws the complementary line (diagnosticity may see the claim, because that judgment is inherently relational), and FR-029 keeps model-generated rivals as hypotheses, never evidence. |
| III. Full Trace, Public and Contestable | **PASS (scoped)** | FR-034/FR-035 stamp model_ids and requester/run identity on every run. The full public/persistent/contestable surface is explicitly deferred (spec.md Assumptions) to the same future persistence feature `001` and `002` already deferred it to. |
| IV. The Schema Is the Contract | **PASS** | FR-033 requires exact conformance to `001`'s existing `LedgerInput` — this feature adapts to that schema, it does not extend or fork it. |
| V. Fetched Content Is Data, Never Instruction | **PASS** | FR-013/FR-017/FR-018/FR-019/FR-036 implement every clause of this principle directly: archival with hash/timestamp/status/URL, delimited untrusted content blocks, injection-echo detection, and offline re-validation from snapshots. |
| VI. Harm Gate Before Spend | **PASS** | This feature is this principle's first implementation in the codebase: FR-001–FR-002a implement the pre-flight classifier, the three-way outcome (including the review-queue addition from `/speckit-clarify`), and FR-037–FR-039 implement the structural registry the same principle names as required config. |
| Architecture and Cost Constraints — hosting stays at the phase it needs | **PASS** | This feature runs locally/in CI, never as a hosted public service — matching "the pipeline MUST NOT be hosted before public BYOK runs require it." |
| Architecture and Cost Constraints — token cost is the governing cost | **PARTIAL (deferred, documented)** | Prompt caching and model tiering by step are named as "required optimizations, not optional ones," but tiering requires measuring cost against real runs first, which this MVP hasn't done yet. This MVP uses a single Gemini model tier throughout (research.md §2) and documents cost-per-claim as something to measure once real runs exist, not something to guess at now — consistent with the constitution's own "decided against measured outcomes, not assumption." |
| Development Workflow — deterministic checks run on every run | **PASS** | The specific checks this section lists (retrievable URL + timestamp + hash, no aggregator misclassified, every fired trigger named) map directly onto FR-013, FR-021, and FR-037–FR-039; this feature implements the pipeline-side half, `001`'s own tests already cover the engine-side half (cluster count, zero-weight rule, band-matches-engine). |
| Development Workflow — fixture suite as merge gate | **N/A** | This feature adds no fixture cases and touches no file under `001`'s `src/trees/`, `src/normalize/`, or `src/aggregate/` — that suite is unaffected. |

**Result**: Gate passes, with one item (model tiering) explicitly and honestly deferred rather than
guessed at — which the constitution's own text endorses over premature optimization.

**Post-Phase-1 re-check**: data-model.md's `LlmClient` interface and research.md's seven decisions
introduce nothing that weakens any PASS above — if anything, the `gradeOrigin` signature having no
claim parameter (research.md §6) makes Principle II's compliance a compile-time property rather
than a documentation claim, which is stronger than what the initial Constitution Check assumed.
The two local JSONL stores (research.md §4) are exactly the Complexity Tracking entry already
justified above; nothing new needs justifying. Gate still passes.

**Post-implementation re-check (T064)**: all 64 tasks complete, all 7 user stories implemented,
108/108 tests passing (up from `001`/`002`'s combined 65 — this feature added 43 of its own),
confirmed offline (`unshare --net`). Every PASS above still holds; two things actually strengthened
during implementation:

- Principle II (blind grading): confirmed by direct test that `gradeOrigin`'s prompt never
  contains a claim string, not just by the type signature.
- Principle V (fetched content is data, never instruction): FR-017's containment wrapper and
  FR-018/019's instruction-echo detection (T059-T061) are now real, tested code
  (`contain.ts`), not just a research.md design intention.

**Two real defects found and fixed during implementation, not just planned around:**

1. `assemble-ledger.ts`'s `buildTreeExtension` originally fell through to `null` for
   `complex_system` claims. `001`'s Tree 4 requires a `Tree4Extension` — a `null` one makes
   `evaluate()` refuse outright rather than compute a band, which would have silently violated
   SC-004 for an entire claim-type category. Caught by direct testing (`evaluate()` on a
   hand-built ledger), not by the test suite that existed at the time — regression tests for all
   three non-simple-factual claim types added afterward.
2. `adversarial.ts`'s first draft reported `status: 'survived'` whenever a test was run, even when
   it found a genuine weakness. That overclaims exactly what Principle I's anti-overclaim stance
   exists to prevent — a test that finds a real problem did not confirm the evidence survived
   scrutiny. Fixed to report `'untested'` when a weakness is found, which correctly caps the band
   at Probable via `001`'s existing logic rather than fabricating confidence.

Gate passes. No unjustified complexity; both defects were caught before commit, not after.

## Project Structure

### Documentation (this feature)

```text
specs/003-judgment-pipeline-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output — this feature DOES need one (see below)
│   └── pipeline-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

Unlike `002`, this feature exposes a real new API surface (`runPipeline()`, callable by a future
UI or CLI) — so, per the plan template's own guidance, it gets a `contracts/` directory, the same
way `001` did for `evaluate()`/`aggregate()`.

### Source Code (repository root)

```text
src-pipeline/
├── harm-gate.ts                 # FR-001-002a: pre-flight classifier, 3-way outcome, review-queue write
├── llm-client.ts                  # LlmClient interface + GeminiLlmClient implementation + MockLlmClient (test-only, exported for other features' tests to reuse)
├── search.ts                       # FR-011, FR-015, FR-016: search-effort stopping condition, candidate discovery
├── retrieve.ts                      # FR-012-014, FR-017-019, FR-036: fetch, archive, containment, offline re-check
├── registry.ts                       # FR-037-039: seed structural registry (aggregator/press_release/preprint/paywalled)
├── grade.ts                           # FR-020-025: blind warrant grading
├── diagnosticity.ts                    # FR-026-027, FR-030: diagnosticity marking against claim and rivals
├── rivals.ts                            # FR-028-029: rival hypothesis generation
├── adversarial.ts                        # FR-031-032: adversarial testing / steelman
├── assemble-ledger.ts                     # FR-033: assembles the final LedgerInput, validated with zod before return
├── run-pipeline.ts                         # Orchestrates harm-gate -> search -> retrieve -> grade -> diagnosticity -> rivals -> adversarial -> assemble
├── index.ts                                 # Public entry point: runPipeline(claim, apiKey) -> PipelineResult
└── cli.ts                                    # Thin CLI wrapper around index.ts, for actually running this locally

src-pipeline/tests/
├── harm-gate.test.ts
├── search.test.ts
├── retrieve.test.ts
├── registry.test.ts
├── grade.test.ts
├── diagnosticity.test.ts
├── rivals.test.ts
├── adversarial.test.ts
├── assemble-ledger.test.ts
└── run-pipeline.test.ts                      # End-to-end against MockLlmClient only
```

**Structure Decision**: A new top-level `src-pipeline/` directory, parallel to `001`'s `src/` and
`002`'s `ui/`, in the same repository and package (one `package.json`, one `node_modules`,
consistent with the precedent both prior features set). Kept separate from `src/` rather than
nested inside it, since `src/`'s own `package.json` scripts and `tsconfig.json` describe a
zero-dependency, browser-and-Node-portable library (`001`'s own Technical Context), while this
feature is deliberately Node-only and brings a real external dependency (`@google/genai`) — mixing
the two would blur `001`'s own "zero runtime dependencies" property for anyone reading `src/`
fresh.

## Complexity Tracking

*One entry, already justified above rather than left implicit:*

| Complexity | Why needed | Simpler alternative rejected because |
|---|---|---|
| Local file-based storage for fetch archives and the review queue, instead of "no persistence at all" | FR-002a and FR-036 both require something to survive the process exiting — a review queue nobody can ever read back isn't a queue, and offline re-validation from a snapshot needs the snapshot to still exist | Zero persistence (matching `001`/`002`'s stricter "no storage of any kind") was considered, but both requirements were added or confirmed *during this feature's own clarify session*, specifically because a database is still out of scope — local files are the smallest thing that satisfies "durable enough" without standing up Postgres/Neon early |
