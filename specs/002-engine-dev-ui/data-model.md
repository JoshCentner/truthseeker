# Phase 1 Data Model: Rule Engine Dev UI

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This UI introduces no new domain types — `LedgerInput`, `CompoundInput`, and `Verdict` are the
engine's own types from `001-rule-engine-core` (`src/schema/ledger.ts`), imported directly. What
follows are the UI-only state shapes needed to hold and render them (spec.md's Key Entities section
named these at a conceptual level; this is their concrete shape).

## Mode

```ts
type Mode = 'evaluate' | 'aggregate';
```

Drives which input shape the Ledger Editor accepts and which engine function `engine-bridge.ts`
calls (FR-010). Switching `Mode` resets the Ledger Draft to empty — per spec.md's Edge Cases
("switches modes with unsaved edits"), Assumptions already establish that drafts aren't persisted
between sessions, so a mode switch is treated the same way a page reload would be: no silent
carry-over of an input shape that no longer matches.

## LedgerDraft

```ts
interface LedgerDraft {
  mode: Mode;
  rawText: string;
  /** Only present in aggregate mode, and only once the user has run once (FR-011). */
  previousSubClaims: CompoundSubClaim[] | null;
}
```

The single piece of state `ledger-editor.ts` owns. `rawText` is exactly what's in the text area,
byte for byte — nothing is auto-formatted or mutated between keystrokes and a Run action (FR-002).

## EngineResult

```ts
type EngineResult =
  | { kind: 'parse-error'; message: string }
  | { kind: 'refusal'; reason: string }
  | { kind: 'verdict'; verdict: Verdict };
```

The return type of `engine-bridge.ts`'s `run(draft: LedgerDraft): EngineResult` — the single
function that turns a `LedgerDraft` into one of the three outcomes research.md §4 distinguishes.
`'parse-error'` never reaches the engine at all (`JSON.parse` failed). `'refusal'` is a `Verdict`
whose `refusalReason` was non-null, unwrapped into its own case so `verdict-display.ts` doesn't
need to branch on a field inside an otherwise-successful-looking type. `'verdict'` is a normal
computed result.

## FixtureLibraryEntry

```ts
interface FixtureLibraryEntry {
  id: string;
  protocolClause: string;
  mode: Mode;
  /** The exact fixture object, used to populate a LedgerDraft when selected (FR-009). */
  raw: EvaluateFixtureCase | AggregateFixtureCase;
}
```

Built once, at startup, from every file `import.meta.glob` discovers under
`tests/fixtures/cases/` (research.md §2) — reusing the `EvaluateFixtureCase`/`AggregateFixtureCase`
types already defined in `tests/fixtures/helpers.ts` rather than declaring a parallel shape.
Read-only from the UI's perspective: selecting one produces a new `LedgerDraft` (via
`JSON.stringify(entry.raw.input, null, 2)`), it never writes back to `entry` or to disk (FR-009,
spec.md Assumptions: "the original fixture file on disk is unchanged").

## VerdictDisplayState

```ts
interface VerdictDisplayState {
  result: EngineResult | null; // null before the first Run
}
```

The only state `verdict-display.ts` needs — a single `EngineResult` (or `null` before anything has
been run) is enough to determine the entire rendered output, since `EngineResult` already carries
everything FR-004/FR-005/FR-006/FR-007/FR-014 require to display.

## State flow

```text
User types/pastes -> LedgerDraft.rawText updates (no engine call)
User clicks Run    -> engine-bridge.run(draft) -> EngineResult -> VerdictDisplayState.result
User selects a fixture -> FixtureLibraryEntry -> new LedgerDraft (mode + rawText set from entry.raw)
User switches Mode  -> LedgerDraft reset to { mode: newMode, rawText: '', previousSubClaims: null }
```

There is no other state in this feature — no routing, no persistence, no server round-trip.
