# Judgment Pipeline

Turns a raw claim into a `LedgerInput` that [`001`'s rule engine](../src/index.ts) accepts: a harm
gate runs first and always; an autonomous web-search step finds and retrieves real sources (via
the model provider's own search grounding, never model memory); each origin is graded blind to
the claim; diagnosticity is marked against the claim and any identified rivals; adversarial
testing checks the lead evidence before assembly. Full design rationale is in
[`specs/003-judgment-pipeline-mvp/`](../specs/003-judgment-pipeline-mvp/) — `research.md` and
`data-model.md` especially.

## Two very different kinds of validation

**Automated (`npm test`)** — runs entirely against `MockLlmClient`, no API key or network access
needed. This is what proves the orchestration itself is correct: the harm gate is a hard stop,
grading never sees the claim (a compile-time property, not just a runtime one — see
`gradeOrigin`'s signature in [`grade.ts`](./grade.ts)), a supplied key never touches disk, and
every assembled ledger is accepted by `001`'s real `evaluate()`.

**Live (a human, with a real key)** — whether Gemini's actual search grounding finds good sources
and whether its actual judgment is sound is not something a mock can tell you. See
[`../specs/003-judgment-pipeline-mvp/quickstart.md`](../specs/003-judgment-pipeline-mvp/quickstart.md)
Part 2 for how to run and manually check a real claim.

## CLI

```bash
export GEMINI_API_KEY=your-key-here
npm run pipeline -- "The claim you want checked"

# or, to avoid the key touching the environment:
echo "$MY_KEY" | npm run pipeline -- "The claim you want checked" --key-stdin
```

Never pass a key as a `--key` flag — it would be visible in shell history and `ps` output to any
other process on the same machine (see `research.md` §5). Exit codes distinguish outcomes:
`0` completed, `1` rejected, `2` needs human review, `3` authorization failed, `4` usage error.

## Public contract

`runPipeline(claim, apiKey, options?)`, exported from [`index.ts`](./index.ts), is the only
supported surface — full contract, including the `needs_review`/`rejected`/`auth_failed`/
`completed` result shapes, in
[`../specs/003-judgment-pipeline-mvp/contracts/pipeline-api.md`](../specs/003-judgment-pipeline-mvp/contracts/pipeline-api.md).
Everything else in this directory is an implementation detail.

## Known MVP limitations (tracked, not silent)

See [`../PROJECT-TRACKER.md`](../PROJECT-TRACKER.md) for the harm-gate review-queue management
workflow and the adversarial-testing revision-feedback loop — both produce honest, conservative
output today (never a fabricated result), with the fuller version tracked as follow-up work.
Non-`simple_factual` claims (causal/predictive/complex-system) also get a deliberately
conservative placeholder rather than full judgment depth — see `assemble-ledger.ts`'s
`buildTreeExtension`.
