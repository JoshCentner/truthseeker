# Quickstart: Judgment Pipeline MVP

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/pipeline-api.md](./contracts/pipeline-api.md)

This feature's automated test suite (`npm test`) validates the entire orchestration against a
`MockLlmClient` and needs no API key or network access — that covers harm-gate routing, blind-
grading isolation, schema conformance, key non-persistence, and the registry logic. It does
**not** and cannot validate whether Gemini's actual search grounding finds good sources or
whether its actual judgment is sound — that needs a human, a real key, and real network access,
which this section covers separately.

## Part 1: automated validation (no key needed)

```bash
npm install
npm test
```

**Expected**: all `src-pipeline/tests/*.test.ts` pass, using `MockLlmClient` throughout. This
proves:
- The harm gate never lets a rejected or review-queued claim reach the search step (SC-001,
  User Story 1's Independent Test).
- `gradeOrigin`'s actual function signature has no parameter a claim could be passed through
  (SC-006) — a compile-time check, verified by `tsc`, not just a runtime assertion.
- No string matching the supplied key ever appears in any file `runPipeline` writes (SC-003) —
  checked by grepping `runs/*.jsonl` after a mock run.
- Every `PipelineResult { kind: 'completed' }` the mock produces has a `ledger` that `001`'s
  `evaluate()` accepts without a `refusalReason` (SC-004).
- An aggregator-domain origin (per the seed registry) is never graded as if it were the original
  source (SC-009).

## Part 2: live validation (needs your own Gemini API key)

Get a key from Google AI Studio, then:

```bash
export GEMINI_API_KEY=your-key-here
node --loader tsx src-pipeline/cli.ts "The Great Wall of China is visible from space with the naked eye."
```

**Expected**: within a few minutes, a `PipelineResult` prints to stdout. This is a well-known,
well-documented false claim with abundant real sources on both sides — a good first live test
because a human can independently judge whether the pipeline's ledger looks right.

**Check by hand**:
- Every origin's URL in the result — open a few yourself. Do they resolve to real content
  matching what the pipeline recorded (SC-005)?
- Does the final band, once you run `evaluate(result.ledger)` from `001`, match what you'd expect
  a careful human to conclude from those sources?
- Try a claim naming a private individual's private life — confirm it's rejected before the CLI
  makes any call past the harm gate (watch for the harm-gate step in the printed trace; no
  `search` or `grade` steps should appear in `steps` for a rejected run).
- Try a genuinely borderline claim (a semi-public person, ambiguous role) — confirm it lands in
  `runs/review-queue.jsonl`, not auto-accepted or auto-rejected (SC-008).

## Part 3: cost awareness

Grounding queries may bill beyond a small free allowance depending on your account and the model
in use (research.md §2) — check Google AI Studio's current pricing for the model
`src-pipeline/llm-client.ts` is configured to use before running many claims. Since this is BYOK,
that cost is yours to watch, not something this feature manages for you.

## Troubleshooting

- **The CLI exits immediately with an authorization error**: distinct from a harm-gate rejection —
  check `GEMINI_API_KEY` is actually set and valid, per contracts/pipeline-api.md's FR-010
  distinction.
- **A run takes much longer than expected**: normal for real multi-step LLM orchestration with
  real retrieval — check the printed step trace to see which step is in progress, rather than
  assuming it's hung.
- **`could_not_retrieve` on a source you can open fine in a browser**: likely a bot-blocking or
  paywall response the plain `fetch()` in `retrieve.ts` can't get past — this is the correct,
  conservative behavior per the accepted FR-014 clarification, not a bug to work around.
