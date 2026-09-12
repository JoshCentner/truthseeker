# Quickstart: Rule Engine Core

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/engine-api.md](./contracts/engine-api.md)

This validates the feature end-to-end once implemented. It proves the Success Criteria in
spec.md, not just that code compiles.

## Prerequisites

- Node.js 20+ LTS
- npm

## Setup

```bash
git clone https://github.com/JoshCentner/truthseeker.git
cd truthseeker
npm install
```

## Validate: the fixture suite passes

```bash
npm test
```

**Expected**: every case in `tests/fixtures/cases/` reports pass, the run completes in well under
60 seconds (SC-008), and the summary shows 100% band-outcome coverage across all four trees plus
normalization, aggregation, and refusal cases (SC-003). A failing case names its id, expected
band, actual band, and the diverging condition (FR-050) — nothing fails silently.

## Validate: zero network, zero cost (SC-001)

Run the same suite with network access removed at the OS level, e.g. inside a container with no
egress, or on Linux via a network namespace:

```bash
unshare --net npm test
```

**Expected**: identical pass/fail result to the networked run. No test requires DNS resolution, an
API key, or any environment variable naming a credential. If any case fails only in this mode,
that case is calling out — a Principle I violation to fix before merging, not a suite bug to
special-case around.

## Validate: determinism (SC-004)

```bash
npm test -- --run tests/suite/run-fixtures.test.ts
npm test -- --run tests/suite/run-fixtures.test.ts
diff <(npm test -- --reporter=json 2>/dev/null) <(npm test -- --reporter=json 2>/dev/null)
```

**Expected**: no diff. Every `Verdict` returned is byte-identical across runs for the same input —
this is what research.md §2's sorting/no-nondeterministic-builtins discipline is verified against.

## Validate: one case by hand (SC-010)

Pick any file under `tests/fixtures/cases/`, e.g. the Tree 1 "two independent clusters, best grade
contemporaneous record, adversarial Survived" case from User Story 2's first acceptance scenario.
Open `AGENT-PROTOCOL-v3.md`'s Tree 1 section side by side with the fixture file. A reviewer with
no knowledge of the implementation should be able to confirm the case's `expected.band` is
`'established'` from the protocol text alone, in under 10 minutes, without reading any engine
source.

## Validate: the public contract

```ts
import { evaluate } from './src/index';
// See contracts/engine-api.md for the full LedgerInput / Verdict shapes (data-model.md has field-
// level detail) — this quickstart does not restate them.

const verdict = evaluate(someLedgerInput);
console.log(verdict.band, verdict.tree, verdict.cappingConditions);
```

**Expected**: no import beyond `evaluate` (and `aggregate`, for compound claims) is needed to use
this package — everything else under `src/` is an implementation detail per the contract.

## Troubleshooting

- **A case fails only sometimes**: this is a determinism bug (research.md §2) — check for an
  unsorted collection or a stray `Date.now()`/`Math.random()` in the tree code, not a flaky test.
- **`refusalReason` appears on a case expected to return a band**: the fixture's `LedgerInput` is
  itself malformed (FR-008 working as intended) — fix the fixture, not the engine.
