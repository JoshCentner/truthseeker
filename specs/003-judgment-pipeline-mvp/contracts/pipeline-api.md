# Contract: Judgment Pipeline Public API

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

This is the only surface a caller outside `src-pipeline/` may depend on — a future `002`
extension, a CLI, or a later orchestration feature. Everything else under `src-pipeline/` is an
implementation detail and may be refactored freely as long as this function's behavior and the
CLI's flags are unchanged.

## `runPipeline(claim: string, apiKey: string, options?: RunOptions): Promise<PipelineResult>`

Exported from `src-pipeline/index.ts`.

```ts
interface RunOptions {
  requester?: string; // free-text attribution label (data-model.md's RunTrace.requester)
  modelId?: string; // overrides research.md §1's default single-model choice
}
```

**Preconditions**: `apiKey` is a non-empty string. `runPipeline` does not validate that the key is
actually valid ahead of time — an invalid key surfaces as a failure from the first LLM call, which
`run-pipeline.ts` distinguishes from every other failure category per FR-010.

**Behavior**:
- Runs the harm gate (FR-001) before any other call. On `reject` or `needs_review`, returns
  immediately (data-model.md's State flow) — search, retrieval, and grading never execute.
- Makes zero calls to any provider other than the one `apiKey` authorizes.
- Never writes `apiKey` anywhere (FR-008/FR-009) — not to the `runs/` directory, not to the
  returned `PipelineResult`, not to any log line this feature emits.
- Returns `{ kind: 'completed', ledger, ... }` only when `ledger` already passes `001`'s own
  ledger validation (FR-033) — a caller never needs to separately validate before calling
  `evaluate(result.ledger)`.
- Throws only for programmer errors (e.g., calling with an empty `apiKey` string) — a real
  authorization failure, a zero-sources-found run, a harm-gate rejection, and a step that
  exhausted its remediation attempts are all normal return values, never thrown exceptions,
  matching `001`'s own "return values for outcomes, exceptions for bugs" convention
  (contracts/engine-api.md).
- Any individual step's LLM call is retried internally (bounded remediation, FR-040–FR-045)
  before its failure ever surfaces to the caller — a caller only sees `needs_clarification` after
  the fixed attempt limit is exhausted, never a raw parse error or a mid-step failure.

**Postconditions**: for `kind: 'completed'`, `evaluate(result.ledger)` (imported from `001`)
never returns a `refusalReason` (SC-004). For `kind: 'needs_clarification'`, `trace` is not
returned (research.md §10 — the run did not complete) but `step` and `questions` are always
non-empty, naming exactly what remains unresolved.

## CLI: `src-pipeline/cli.ts`

```bash
GEMINI_API_KEY=... node src-pipeline/cli.ts "claim text here" [--requester "name"]
# or, to avoid the key touching the environment at all:
echo "$MY_KEY" | node src-pipeline/cli.ts "claim text here" --key-stdin
```

**Behavior**: reads the claim from its first positional argument and the key from
`GEMINI_API_KEY` or `--key-stdin` (research.md §5) — **never** from a `--key` flag, since a flag
value is visible in shell history and `ps` output on the same machine. Prints the `PipelineResult`
as formatted JSON to stdout; each `PipelineResult.kind` exits with its own distinct status code
from `completed` (0), so the CLI is scriptable: `1` rejected, `2` needs_review, `3` auth_failed,
`4` usage error, `6` needs_clarification (research.md §10's bounded-remediation amendment; `5` is
reserved for an unexpected/uncaught error, distinct from every normal outcome above it).

## Explicitly not in this contract

- Any HTTP/RPC server — `runPipeline` is an in-process async function, not a service.
- The `runs/review-queue.jsonl` and fetch-archive file formats (data-model.md) — internal storage
  detail, not part of what a caller depends on; a future persistence feature may migrate these
  into a database without this contract needing to change.
- Batch or concurrent multi-claim processing — one call, one claim (spec.md Scale/Scope).
