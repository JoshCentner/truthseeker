# Phase 0 Research: Rule Engine Core

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

No NEEDS CLARIFICATION markers remain in the Technical Context — language, testing, and platform
were settled directly with the project owner (TypeScript/Node.js, Vitest; see plan.md). This
research resolves the technology and design choices Technical Context deferred to Phase 0.

## 1. Runtime ledger validation

**Decision**: Zod, used at exactly one boundary — the moment an external ledger (arbitrary JSON)
enters `src/schema/validate.ts`. Internal code after that boundary relies on TypeScript's static
types alone.

**Rationale**: FR-004 requires every field the engine reads to be explicitly typed with permitted
values so out-of-range input is detectable, and FR-008 requires the engine to refuse rather than
guess when an input is missing or invalid. TypeScript types are erased at compile time and cannot
catch a malformed ledger arriving as JSON from outside the package (e.g., from the future
pipeline). Zod schemas double as the runtime check and the source of the inferred static type
(`z.infer<>`), so the permitted-values list is written once, not maintained in two places that can
drift apart. Zod has no runtime dependencies of its own and is widely used, which matters for a
package a fork should be able to read end to end.

**Alternatives considered**: *io-ts* — more powerful (fp-ts-style combinators) but a steeper
read for a forker skimming the code, and the extra power (e.g., typeclasses) isn't needed for a
flat ledger shape. *Valibot* — smaller bundle, but bundle size is irrelevant for a Node-only
package with no browser target, and its ecosystem/error-message maturity is behind Zod's. *Hand-
written validators* — zero dependencies, but FR-004's "every field explicitly typed with its
permitted values" is exactly Zod's job, and hand-rolling it risks the exact silent-coercion bug
FR-004 exists to prevent.

## 2. Determinism and canonical output

**Decision**: (a) The engine core contains no calls to `Date.now()`, `Math.random()`, or any other
non-deterministic built-in — the only inputs to a verdict are the ledger's own fields. (b) Cluster
membership, condition lists, and any other collection in the verdict output are sorted by a stable
key (e.g., origin id) before being returned, never left in insertion or `Set`/`Map` iteration
order. (c) "Byte-identical" (FR-006, SC-004) is verified in the fixture suite by running each case
twice and comparing `JSON.stringify` output directly — no custom canonicalizer is needed because
(a) and (b) already remove the only two sources of nondeterminism JSON.stringify would otherwise
expose (object key insertion order and floating-point formatting; the latter doesn't arise because
no verdict field is a float — FR-044 bans numeric scores outright).

**Rationale**: Determinism in a garbage-collected, dynamically-typed runtime is a discipline
problem, not a language-guarantee problem — TypeScript's type system doesn't stop someone from
calling `Date.now()` inside a tree function. Making the two failure modes explicit (sorting,
banning specific built-ins) turns SC-004 into something a code reviewer can check by eye per the
constitution's "unjustified complexity is grounds for rejection" standard, rather than something
that has to be inferred from test results.

**Alternatives considered**: A dedicated canonical-JSON library (e.g., `canonicalize`) — adds a
dependency to solve a problem (key ordering) that's already solved for free once object
construction itself is disciplined; deferred unless the fixture suite finds an ordering bug this
doesn't catch. A property-based/fuzz test for determinism — valuable, but out of scope for this
feature's fixture-suite-only test strategy (FR-047–FR-051 specify hand-worked cases, not
generative testing).

## 3. Enforcing the judgment-vs-computed field distinction (FR-003)

**Decision**: Two separate TypeScript interfaces — `LedgerInput` (judgment fields only, what
callers supply) and `Verdict` (computed fields only, what the engine returns) — with no shared
interface that a caller could pre-populate. `validate.ts` parses incoming JSON against the
`LedgerInput` Zod schema only; if a payload contains any key that belongs to `Verdict`'s shape
(e.g., a caller pre-populating `band`), validation fails closed and the engine reports which field
was rejected, per FR-008's refusal contract.

**Rationale**: FR-003 requires refusing a ledger where a computed field is pre-populated with a
conflicting value. Modeling judgment and computed data as genuinely separate types — rather than
one `Ledger` type with some fields marked optional-until-computed — makes it a type error, not
just a runtime check, for engine code to accidentally read a computed field as if it were input.
The runtime rejection in `validate.ts` then covers the case FR-003 is actually worried about: an
external caller sending computed-looking data in.

**Alternatives considered**: A single interface with a `readonly` modifier on computed fields —
`readonly` is compile-time-only and does not prevent a JSON payload (which has no `readonly`
concept) from carrying an extra key, so it doesn't satisfy FR-003's runtime refusal requirement by
itself. Branded/nominal types for computed fields — adds indirection with no benefit here, since
the two interfaces already don't overlap in shape.

## 4. Fixture case format and suite runner

**Decision**: Fixture cases live as individual TypeScript modules under `tests/fixtures/cases/`,
each exporting `{ id, ledger, expected: { band, qualifier?, tree } }`. `tests/suite/run-fixtures.
test.ts` imports every case (via a directory-glob import), runs each through `src/index.ts`'s
`evaluate()`, and asserts band/qualifier/tree per case with the case id in the failure message —
directly satisfying FR-050's requirement that a failing case report its id, expected band, actual
band, and diverging condition.

**Rationale**: TypeScript modules (over JSON/YAML fixture files) let a fixture case use the same
`LedgerInput` type as the engine itself, so a fixture with a typo'd field name fails to compile
instead of silently testing the wrong thing — an extra safety net FR-051's "no boundary can move
silently" is exactly aimed at. One file per case keeps SC-010's "reviewer confirms a single
fixture case in under 10 minutes" easy: the reviewer opens one small file, not a JSON blob nested
inside a larger array.

**Alternatives considered**: A single large JSON fixture file — simpler tooling, but fails the
type-safety benefit above and makes per-case diffs and case-by-case review (SC-010) harder in
review tools. A YAML DSL mirroring the protocol's own prose — closer to the protocol document, but
building and maintaining a parser for it is exactly the kind of complexity the constitution asks
to be justified, and is not warranted for what is fundamentally test data.

## 5. Version stamping

**Decision**: `engineVersion` and `schemaVersion` are literal semver string constants exported
from `src/schema/ledger.ts` (schema) and `src/index.ts` (engine), bumped by hand as part of any
PR that changes the relevant surface, and stamped onto every `Verdict` by `verdict/assemble.ts`
(FR-045). No build-time version injection or package.json-version syncing is introduced.

**Rationale**: The constitution requires protocol, engine, schema, and registry versions to move
independently (Governance: "Protocol version, engine version, registry version, and schema version
are versioned separately"). A hand-bumped constant is the simplest mechanism that satisfies this
and needs no tooling; anything more automated (e.g., deriving engineVersion from git tags) is
solving a problem — accidentally forgetting to bump — that PR review (a constitution-mandated gate
for any engine change) already exists to catch.

**Alternatives considered**: Deriving version from `package.json` — collapses engine and schema
version into one number, which the constitution explicitly prohibits ("Versions are
independent"). Git-tag-derived versioning — adds CI complexity for a problem hand-bumping already
solves at this scale.
