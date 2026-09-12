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

The suite itself asserts byte-identical output for two in-process calls with the same input
(`FR-006/SC-004` test in `run-fixtures.test.ts`) — that's the primary check. To confirm it holds
across separate process runs too (implementation note: a raw diff of `--reporter=json` output is
noisy, since it embeds run timestamps and durations that differ between runs regardless of engine
determinism):

```bash
npx vitest run --reporter=json > /tmp/run1.json
npx vitest run --reporter=json > /tmp/run2.json
python3 -c "
import json
def outcomes(path):
    data = json.load(open(path))
    return sorted((t['fullName'], t['status']) for s in data['testResults'] for t in s['assertionResults'])
print(outcomes('/tmp/run1.json') == outcomes('/tmp/run2.json'))
"
```

**Expected**: `True`. Every fixture's pass/fail outcome is identical across independent process
runs — this is what research.md §2's sorting/no-nondeterministic-builtins discipline is verified
against.

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
