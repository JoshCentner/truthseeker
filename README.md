# GroundTruth Rule Engine

The deterministic core of the GroundTruth Execution Platform: a typed schema, four decision
trees, ledger normalization, compound-claim aggregation, and the fixture suite that proves the
engine reproduces [AGENT-PROTOCOL-v3.md](../../AGENT-PROTOCOL-v3.md)'s methodology exactly.

This package makes **zero network calls, zero model calls, and costs zero dollars to run**. Every
verdict is a pure function of its input ledger — see
[`.specify/memory/constitution.md`](.specify/memory/constitution.md) Principle I.

## Quick start

```bash
npm install
npm test
```

See [`specs/001-rule-engine-core/quickstart.md`](specs/001-rule-engine-core/quickstart.md) for the
full validation sequence (offline run, determinism check, manual protocol cross-reference).

## Using it

```ts
import { evaluate, aggregate } from './src/index.js';

const verdict = evaluate(someLedgerInput);
console.log(verdict.band, verdict.tree, verdict.cappingConditions);
```

`evaluate()` and `aggregate()` are the **entire public surface** of this package — everything
under `src/normalize/`, `src/trees/`, and `src/aggregate/` is an implementation detail that may
change freely as long as the fixture suite still passes. Full contract, including preconditions,
postconditions, and the `previous`-argument recompute convention, is in
[`specs/001-rule-engine-core/contracts/engine-api.md`](specs/001-rule-engine-core/contracts/engine-api.md).

## How it's organized

| Path | What's there |
|---|---|
| `src/schema/` | The typed `LedgerInput`/`Verdict` schema (deliberately disjoint — see `research.md` §3), Zod runtime validation, version constants |
| `src/normalize/` | Zero-weight rule, trigger application, interested-party table, cluster partitioning, non-diagnostic exclusion |
| `src/trees/` | The four decision trees (simple-factual, causal, predictive, complex-system) |
| `src/aggregate/` | Compound-claim aggregation from sub-claim bands |
| `src/verdict/` | Verdict assembly and trace stamping |
| `tests/fixtures/cases/` | Hand-worked cases, one per file, each traceable to a specific protocol clause |
| `tests/suite/` | The fixture-suite runner — the correctness foundation for this whole engine |

For the full design rationale (why TypeScript, why Zod, why fixtures are TS modules rather than
JSON, how determinism is enforced), see
[`specs/001-rule-engine-core/research.md`](specs/001-rule-engine-core/research.md) and
[`data-model.md`](specs/001-rule-engine-core/data-model.md).

## Contributing

Per the constitution's Development Workflow section: changes to `src/trees/`, `src/normalize/`,
or `src/aggregate/` are **methodology changes**, not ordinary application code, and go through
methodology review rather than standard code review. The fixture suite is the merge gate — it
must pass with no network access and no credentials configured.
