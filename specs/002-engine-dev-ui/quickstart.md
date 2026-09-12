# Quickstart: Rule Engine Dev UI

**Feature**: [spec.md](./spec.md) | **Data model**: [data-model.md](./data-model.md)

## Prerequisites

- Node.js 20+ LTS (already required by `001-rule-engine-core`)
- `npm install` already run at the repo root

## Setup

```bash
npm install   # adds vite as a devDependency the first time this feature's tasks run
npm run dev   # starts the Vite dev server for ui/
```

Open the printed local URL (typically `http://localhost:5173`) in a browser.

## Validate: User Story 1 — evaluate a pasted ledger (SC-001)

1. Open the tool. Start a timer.
2. Paste a hand-typed `LedgerInput` JSON object into the text area.
3. Click Run.

**Expected**: the verdict's band, qualifier (if any), tree, every condition met, and every
capping condition are all visible — under one minute from step 1, with no source code consulted.

## Validate: fixture fidelity (SC-002)

1. Open the Fixture Library list.
2. For each of the engine's fixture cases, select it, click Run, and compare the displayed band/
   qualifier/tree against that fixture's `expected` value.

**Expected**: exact match, 100% of the time — this is the same guarantee
`tests/suite/run-fixtures.test.ts` already proves for the engine itself; this check proves the UI
doesn't introduce any drift between what the engine returns and what gets displayed.

## Validate: capping conditions always shown (SC-003)

1. Run any fixture whose expected band is below its tree's ceiling (e.g. `tree1-probable-
   adversarial-untested`, or anything Contested/Doubtful/Unsupported/Refuted).

**Expected**: at least one capping condition is visible. There is no code path in
`verdict-display.ts` that renders a non-ceiling band without also rendering its
`cappingConditions` array — if that array is ever empty for a non-ceiling band, that's an engine
bug (per `001`'s FR-043), not something the UI should paper over.

## Validate: invalid input is diagnosed fast (SC-004)

1. Type `{ this is not json` into the text area.
2. Click Run. Start a timer at the click.

**Expected**: a specific parse-error message (not a blank screen, not a generic "error") appears
in well under one second — `JSON.parse` failing is synchronous, so this should be near-instant.

## Validate: zero network requests (SC-005)

The engine itself already proves it makes zero network calls (`001`'s own `unshare --net`
validation) — what this checks is that the UI layer doesn't introduce any. A namespace-isolated
server (`unshare --net vite preview`) can't be reached by a `curl` outside that namespace anyway
(network namespaces isolate loopback too, not just external egress), so the right check here is
static: search the UI source and the production bundle for anything that could make a network
call.

```bash
grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|\.ajax(" ui/*.ts
npm run ui:build
grep -o "fetch(\|XMLHttpRequest\|new WebSocket" dist-ui/assets/*.js
```

**Expected**: zero matches in `ui/*.ts`. The production bundle will show one `fetch(` — that's
Vite's own same-origin module-preload polyfill, a build-tool artifact for loading the app's own JS
chunks faster in browsers without native `modulepreload` support. It has nothing to do with
verdict computation and never fires for anything outside the app's own bundle; there is no other
network-capable call anywhere in the shipped code.

## Validate: fixture discoverability (SC-006)

1. Without any prior explanation, ask someone to find and load the fixture case demonstrating
   Tree 1's Established band.

**Expected**: found and loaded in under 30 seconds — the Fixture Library's list must be organized
or labeled well enough (by protocol clause, per FR-008) that this doesn't require reading file
names or source code.

## Validate: aggregation mode (User Story 3)

1. Switch to Aggregate mode.
2. Paste the input from `tests/fixtures/cases/aggregate-recompute-moved-by.ts`, including its
   `previous` value.
3. Run it.

**Expected**: the displayed verdict's `movedBy` names `sc-b`, matching that fixture's `expected`
value exactly.
