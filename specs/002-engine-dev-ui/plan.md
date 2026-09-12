# Implementation Plan: Rule Engine Dev UI

**Branch**: `main` | **Date**: 2026-09-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-engine-dev-ui/spec.md`

## Summary

A local, frontend-only page that lets a developer or reviewer paste or load a ledger, run it
through the existing `001-rule-engine-core` engine, and see the resulting verdict with its full
trace — or build a compound input and see an aggregation verdict. Technical approach: a
dependency-light Vite + TypeScript single-page app, no UI framework, importing the engine's
`evaluate()`/`aggregate()` and the existing fixture case files directly from the same repository
rather than duplicating either.

## Technical Context

**Language/Version**: TypeScript 5.x (same as the engine), targeting evergreen browsers (ES2022)

**Primary Dependencies**: Vite (dev server + static build) only. No UI framework — the surface is
a text area, a run button, a mode toggle, a fixture list, and a results panel; a framework's build
overhead isn't justified for that, and it keeps this tool's dependency footprint as small as the
engine's own (zero-dependency) philosophy. Imports `evaluate()`/`aggregate()` and the
`LedgerInput`/`CompoundInput`/`Verdict` types directly from `../src/index.ts` — same repository,
same package, not a published dependency — and the existing fixture files under
`tests/fixtures/cases/` as the Fixture Library's only data source (FR-008), so there is exactly
one copy of every fixture, not two.

**Storage**: N/A — the Ledger Draft is in-memory only for the session (spec Assumptions: no
persistence, no save-to-fixture-file).

**Testing**: Vitest (already in use for the engine), with the `jsdom` environment declared
per-file for DOM-interaction tests, rather than introducing a second test runner.

**Target Platform**: A modern desktop browser, run via `npm run dev` (Vite dev server) or a static
build a developer opens locally. No deployment is required for this feature to be complete
(spec Assumptions), though a static Vite build means nothing here blocks hosting it later.

**Project Type**: Single-page web app, frontend-only — no backend or server component beyond
Vite's own dev server, since evaluation happens entirely client-side by calling the engine
in-process.

**Performance Goals**: SC-001 (verdict displayed within a minute of opening the tool) and SC-004
(a parse error surfaced within a second) are both trivially met once wired up — `evaluate()`
itself runs in milliseconds per the engine's own SC-008 budget; the goals here are about the UI
never blocking on anything slower than that, not about the engine's own speed.

**Constraints**: Zero network requests to produce a verdict (FR-012, SC-005). No persistence of
any kind. The UI MUST NOT reimplement or approximate any banding logic — every verdict it shows
MUST come from calling the real `evaluate()`/`aggregate()` (FR-003), never from UI-side
approximation, so the tool can never drift from the engine it's inspecting.

**Scale/Scope**: Single-user, single-session. No concurrent-user or multi-tenant concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Basis |
|---|---|---|
| I. Deterministic Verdicts | **PASS** | The UI computes nothing — it is a pure display wrapper around `evaluate()`/`aggregate()`. It inherits the engine's determinism entirely, and the Technical Context constraint above makes reimplementing any banding logic in the UI an explicit non-goal. |
| II. Blind and Mirrored Judgment | **N/A** | No judgment or grading happens in this tool. |
| III. Full Trace, Public and Contestable | **PASS (scoped)** | The UI surfaces the full trace already on the `Verdict` (conditions, capping conditions, version stamps — FR-004, FR-005) for this tool's internal audience. It is not the platform's public contestable surface (that is the future Phase 1 site), so no persistence or publication obligation attaches here. |
| IV. The Schema Is the Contract | **PASS** | The UI validates input by calling the engine's own `evaluate()`/`aggregate()` (which validate internally), rather than re-implementing or duplicating schema validation. |
| V. Fetched Content Is Data, Never Instruction | **PASS** | Pasted ledger text is parsed with `JSON.parse` and passed to the engine as data. Nothing here executes or evaluates user-supplied text as code. |
| VI. Harm Gate Before Spend | **N/A** | Zero API calls, zero spend (spec Assumptions) — there is no spend to gate. |
| Architecture and Cost Constraints | **N/A** | No persistence, no claim graph, no hosting decision required by this feature. |
| Development Workflow — fixture suite as merge gate | **PASS** | This feature adds no fixture cases and touches none of `src/trees/`, `src/normalize/`, or `src/aggregate/` — the existing `001` fixture suite remains untouched as the engine's merge gate. This feature's own correctness is checked by its own lightweight tests verifying it *displays* engine output correctly, never by re-deriving banding logic. |

**Result**: Gate passes cleanly. No Complexity Tracking entries required.

**Post-Phase-1 re-check**: data-model.md's `EngineResult` tagged union and research.md's five
decisions introduce nothing that touches a constitution principle — `EngineResult` is a UI-only
display shape wrapping the engine's own `Verdict`/`refusalReason`, not a new computation, so
Principle I's determinism guarantee still rests entirely on the engine, unchanged. Gate still
passes.

**Post-implementation re-check (T028)**: verified statically (not just asserted) that the shipped
code contains zero `fetch`/`XMLHttpRequest`/`WebSocket` calls in `ui/*.ts`, and exactly one such
call in the production bundle — Vite's own same-origin module-preload polyfill, unrelated to
verdict computation (quickstart.md's corrected SC-005 section). This confirms Principle I and
FR-012 hold at the implementation level, not just in the design. All 42 Vitest tests pass
(23 engine + 19 across five UI test files), `tsc -p tsconfig.test.json` is clean, and
`vite build` succeeds. No principle was touched by anything built in this feature; gate passes.

## Project Structure

### Documentation (this feature)

```text
specs/002-engine-dev-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by /speckit-plan)
```

No `contracts/` directory: this feature exposes no API of its own for anything else to depend on
— it is a leaf consumer of `001-rule-engine-core`'s already-documented contract
(`specs/001-rule-engine-core/contracts/engine-api.md`), not a new seam that needs one.

### Source Code (repository root)

```text
ui/
├── index.html              # Vite entry point
├── main.ts                  # Boots the app, wires the DOM together
├── style.css                 # Plain CSS — no framework, no design system beyond this tool's own needs
├── engine-bridge.ts           # Thin wrapper: parses pasted JSON, calls evaluate()/aggregate() from
│                               # ../src/index.ts, surfaces parse errors distinctly from engine refusals
│                               # (FR-003, FR-006, FR-007, FR-012)
├── ledger-editor.ts            # Text area, mode toggle (evaluate/aggregate), Run action (FR-001, FR-002, FR-010, FR-011)
├── verdict-display.ts           # Renders band/qualifier/tree/conditions/capping/versions/dependence map (FR-004, FR-005, FR-014)
├── fixture-library.ts            # Discovers and lists fixture cases via Vite's import.meta.glob, loads one into the editor (FR-008, FR-009)
└── clipboard.ts                   # Copies the current verdict as JSON (FR-013)

ui/tests/
├── engine-bridge.test.ts
├── fixture-library.test.ts
└── verdict-display.test.ts        # jsdom-environment: asserts rendered DOM reflects a given Verdict

vite.config.ts                      # Repository root, `root: 'ui'`
```

**Structure Decision**: A single frontend-only directory (`ui/`) living alongside `src/` in the
same repository and package — not a separate package, not a monorepo. It imports the engine
directly via relative paths, so there is exactly one `package.json`, one `node_modules`, and one
source of truth for the engine's types and fixtures.

## Complexity Tracking

*No entries — Constitution Check passed without requiring any justified exception.*
