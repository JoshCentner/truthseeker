# Contract: Rule Engine Public API

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

This is the only surface a caller outside this package (the future orchestration-pipeline
feature) may depend on. Everything under `src/normalize/`, `src/trees/`, and `src/aggregate/` is
an internal implementation detail and is not part of this contract — it may be refactored freely
as long as these two functions' behavior is unchanged and the fixture suite still passes.

## `evaluate(input: LedgerInput): Verdict`

Exported from `src/index.ts`.

**Preconditions**: none the caller must establish beyond producing a value that parses as
`LedgerInput` — validation is the callee's job, not the caller's (FR-004, FR-008).

**Behavior**:
- Performs no network access, no model call, no retrieval of any kind (FR-005).
- Returns the same `Verdict` byte-for-byte on every call with the same `input` (FR-006, SC-004).
- Never throws for a structurally invalid `input`: returns a `Verdict` with `refusalReason` set
  instead (FR-008). Throwing is reserved for programmer errors only (e.g., calling with `null`),
  never for bad ledger data — a caller MUST be able to treat every return value as a valid outcome
  to branch on, not wrap every call in try/catch to handle malformed claims.
- `screens.falsifiability === 'fired'` short-circuits to `{ band: 'unfalsifiable', tree: 'screen',
  ... }` without running normalization or any tree (FR-033).

**Postconditions**: the returned `Verdict` satisfies every Success Criterion in spec.md that
applies to a single-claim evaluation (SC-002 through SC-007, SC-009).

## `aggregate(input: CompoundInput): Verdict`

Exported from `src/index.ts`.

**Preconditions**: none beyond `CompoundInput` shape. Sub-claim bands are supplied already
computed — this function does not call `evaluate()` on them and does not re-derive evidence (spec
Assumption: "Judgments arrive already made" extends to "sub-claim bands arrive already computed"
for this function specifically).

**Behavior**:
- Returns `{ band: 'unresolvable', ... }` immediately if any load-bearing sub-claim's band is
  `'unresolvable'` (FR-038), without evaluating the others.
- Refuses (via `refusalReason`, same convention as `evaluate()`) if `edges` contains a cycle
  (FR-040) — never recurses.
- Recomputes deterministically from `subClaims` alone with no re-evaluation of underlying evidence
  (FR-039); `movedBy` names whichever sub-claim's band differs from a hypothetical prior call, when
  the caller re-invokes after changing exactly one sub-claim's band. (The function itself is
  stateless — "recompute" means "this call's output is a pure function of this call's input,"
  not that the function remembers a previous call. Tracking *which* sub-claim changed between two
  calls is the caller's responsibility; `aggregate()` reports `movedBy` only when exactly one
  `subClaims` entry differs from a `previous` argument the caller may optionally supply — see
  below.)

To support `movedBy` without giving `aggregate()` memory of its own, its full signature is:

```ts
aggregate(input: CompoundInput, previous?: { subClaims: CompoundInput['subClaims'] }): Verdict
```

When `previous` is supplied and exactly one sub-claim's band differs from it, `movedBy` is set to
that sub-claim's `id`. When `previous` is omitted, `movedBy` is always `null` — this is a fresh
evaluation, not a recompute, and there is nothing to name.

**Postconditions**: the returned `Verdict` satisfies SC-002 (band correctness), SC-004
(determinism — for a fixed `(input, previous)` pair), and the aggregation acceptance scenarios in
User Story 5.

## Versioning contract

`engineVersion` and `schemaVersion` on every returned `Verdict` are the caller's only supported way
to detect a behavior change (research.md §5). The pipeline feature MUST NOT infer engine behavior
from `Verdict` shape alone — a minor schema addition (a new optional field) does not bump
`engineVersion`, but any change to banding logic does, per Constitution IV and the Governance
section's versioning policy.

## Explicitly not in this contract

- Persistence, storage, or a database of any kind (Storage: N/A).
- Any HTTP, RPC, or process boundary — this is an in-process function call.
- Ledger *population* (turning raw evidence into a `LedgerInput`) — that is the judgment layer's
  job, a separate feature.
