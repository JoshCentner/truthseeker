# Implementation Plan: Claim Dashboard

**Branch**: `main` | **Date**: 2026-09-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-claim-dashboard/spec.md`

## Summary

A small Node HTTP server that safely brokers a visitor's claim and API key into
`003`'s `runPipeline()` (never exposing the key to the browser), streaming step-by-step progress
and the final `PipelineResult` back to a browser dashboard over one HTTP connection. The dashboard
renders each of `003`'s four outcomes in a form specific to it, with a completed verdict shown as
readable prose and structured evidence, not raw JSON.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+ LTS — same as `001`/`002`/`003`.

**Primary Dependencies**: None new beyond what's already in this repo. The server uses Node's
built-in `http` module directly — two routes and a streaming response don't justify adding
Express or a similar framework, matching this repo's running preference for the smallest
dependency footprint that does the job (`001`'s zero runtime deps, `002`'s framework-free UI).
The frontend is a second Vite entry point alongside `002`'s existing one (same `ui/` project,
same `vite.config.ts`, same `node_modules`) rather than a new toolchain.

**Storage**: N/A — matching `001`/`002`/`003`'s precedent. A run's progress and result live only
in the server's in-memory closure for the duration of that one HTTP connection; nothing survives
the connection closing (spec.md Assumptions: no persistence, no resumability).

**Testing**: Vitest (existing). The server's request-handling logic is tested against `003`'s
`MockLlmClient` (imported from `src-pipeline`, no real key or network needed) and a fake HTTP
request/response pair; the frontend's SSE-parsing and rendering logic is tested with `jsdom` and a
scripted fake stream, the same pattern `002` already established for its own DOM tests.

**Target Platform**: The server is Node-only, matching `003`'s own hard constraint that the API
key must never reach a browser context. The frontend is a browser page that talks to the server
over HTTP — it never imports `003`'s pipeline or `@google/genai` directly.

**Performance Goals**: SC-003 requires a visible progress update within a few seconds of a step
actually starting — trivially met by emitting a progress event the moment `003`'s orchestrator
calls each step, not on any polling delay. No goal on total run time, which `003`'s own plan
already scoped as multi-minute and out of this feature's control.

**Constraints**: The visitor's key exists only inside the one request handler's closure for the
lifetime of that HTTP connection — never written to a variable outside that scope, a log line, or
a file (FR-003). If the connection drops before the run completes, the run MUST be aborted
server-side rather than left running invisibly on the visitor's own API quota with no one able to
see the result — this is the only behavior consistent with spec.md's "no persistence, no resume"
Assumptions applied honestly to a real disconnect (research.md §4).

**Scale/Scope**: One claim per HTTP connection; concurrent visitors are isolated by ordinary
per-request closure scope (SC-005) — no shared server-side session state of any kind is needed to
achieve that isolation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Basis |
|---|---|---|
| I. Deterministic Verdicts | **N/A** | This feature computes nothing — it's a transport and display layer over `003`'s already-produced `PipelineResult`. No banding or judgment logic is reimplemented here. |
| II. Blind and Mirrored Judgment | **N/A** | No judgment happens in this feature; it inherits whatever `003` already produced. |
| III. Full Trace, Public and Contestable | **PASS (scoped)** | The dashboard surfaces `003`'s existing trace (steps, conditions, capping conditions) for this feature's visitor-facing audience. It is not yet the platform's persistent public/contestable surface (no storage — spec.md Assumptions), consistent with every prior feature's same deferral. |
| IV. The Schema Is the Contract | **PASS** | The dashboard renders `003`'s `PipelineResult`/`001`'s `Verdict` types directly; it declares no parallel schema of its own. |
| V. Fetched Content Is Data, Never Instruction | **N/A** | This feature fetches nothing itself — all retrieval happens inside `003`, already covered by `003`'s own containment guarantees. |
| VI. Harm Gate Before Spend | **PASS (inherited)** | The dashboard calls `003`'s `runPipeline()` unmodified, which already runs the harm gate first. This feature adds no second path that could bypass it. |
| Architecture and Cost Constraints — hosting stays at the phase it needs | **PASS** | Per spec.md Assumptions, this feature does not require standing up a public hosted deployment — a visitor runs it themselves, the same self-hosted BYOK model `003` already assumes. |
| Development Workflow — fixture suite as merge gate | **N/A** | This feature touches no file under `001`'s `src/trees/`, `src/normalize/`, or `src/aggregate/`, and no file under `003`'s judgment steps — only a new, additive, optional progress callback on `003`'s own public entry point (research.md §2). |

**Result**: Gate passes cleanly. No Complexity Tracking entries beyond the one already-justified
"abort on disconnect" behavior (a direct, honest consequence of the no-persistence Assumption,
not new complexity).

**Post-Phase-1 re-check**: data-model.md's `ServerEvent`/`DashboardState` types and research.md's
five decisions introduce nothing that changes any row above — the `onProgress` extension to `003`
(research.md §2) is additive and optional, so `003`'s existing Constitution Check is untouched by
it. Gate still passes.

**Post-implementation re-check (T033)**: all 33 tasks complete, all 4 user stories implemented,
144/144 tests passing across the whole repo (up from `003`'s 117), confirmed via static analysis
(not `unshare --net`, which doesn't work for this feature's real-socket server tests) that the
dashboard makes zero external network calls of its own, clean `tsc`, clean `eslint`, `001`'s
standalone build unaffected, both Vite entry points (`index.html` and `dashboard.html`) build
cleanly. Every PASS above still holds.

**One real, load-bearing gap found and fixed during implementation**: `001`'s `Origin.id` was an
arbitrary counter (`origin-0`, `origin-1`, ...) with no field anywhere carrying the source's actual
URL — meaning FR-007's "show every origin's URL" was structurally impossible to satisfy from
`PipelineResult.ledger` alone, since `001`'s schema was never designed to carry one. Fixed at the
source in `003`'s `retrieve.ts`: origin ids are now the candidate's real URL, deduplicated with a
numeric suffix only on an actual collision. This is a schema-level fix to an already-shipped prior
feature (`003`), made because a downstream consumer's genuine requirement revealed a real gap —
matching the same pattern as `001`'s `channelKeys` addition and `003`'s own `CompoundSubClaim`
re-export, not a new decision invented here.

**Two testability gaps found and fixed, mirroring each other**: neither `runPipeline()` (`003`)
nor `createDashboardServer()` (this feature) originally had any way to inject a `MockLlmClient`,
since both construct a real client internally from the supplied key. Fixed by exporting `003`'s
lower-level `runOrchestration()` (documented honestly in `003`'s own contracts/pipeline-api.md as
a secondary surface) and adding an optional `llm` parameter to `createDashboardServer()` — both
minimal, additive changes that made every test in this feature's suite runnable without a real key
or network access.

Gate passes. No unjustified complexity; every gap above was caught by writing and running real
tests, not left for a human to discover later.

## Project Structure

### Documentation (this feature)

```text
specs/004-claim-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/            # Phase 1 output — this feature exposes a real HTTP API
│   └── dashboard-api.md
└── tasks.md              # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
dashboard/
├── server.ts               # Node http server: POST /api/run streams progress + result over one connection
├── run-with-progress.ts      # Thin wrapper: calls 003's runPipeline() with an onProgress callback (research.md §2)
└── sse.ts                     # Minimal SSE-formatting helpers shared by server.ts

dashboard/tests/
├── server.test.ts
└── run-with-progress.test.ts

ui/                          # 002's existing Vite project — this feature adds a second page here
├── dashboard.html             # New Vite entry point, alongside 002's existing index.html
├── dashboard-main.ts            # Boots the dashboard page
├── dashboard-client.ts            # Submits the form, consumes the streamed response via fetch() + a manual SSE parser (research.md §3)
├── dashboard-display.ts             # Renders each of 003's four outcomes; a completed verdict as readable prose + evidence list
└── tests/
    ├── dashboard-client.test.ts
    └── dashboard-display.test.ts

vite.config.ts                # Updated: multi-page build (index.html + dashboard.html), dev-server proxy for /api -> the Node server (research.md §5)
```

**Structure Decision**: A new `dashboard/` directory for the server (parallel to `001`'s `src/`,
`002`'s `ui/`, `003`'s `src-pipeline/`), and new files inside `002`'s existing `ui/` Vite project
for the frontend rather than a third toolchain — the dashboard is a browser page like `002`'s dev
UI is, just a different one, so it reuses the same build setup rather than duplicating it.

## Complexity Tracking

*No entries requiring justification beyond what's already covered above.*
