# Project Tracker

Follow-up work deliberately deferred out of a feature's own scope during spec-kit sessions, so it
doesn't get lost between features. Not a replacement for `specs/*/tasks.md` — this is for items
that don't belong to any single feature's task list, usually because the feature that will need
them hasn't been specified yet.

## Open

- **Harm-gate review-queue management** — `003-judgment-pipeline-mvp`'s harm gate records a
  "needs human review" status for borderline claims (FR-002a), but the actual workflow for
  reviewing, resolving, and acting on that queue (who reviews it, how a resolution feeds back into
  a re-run, how long an unresolved item sits) is not built by `003` and has no feature spec yet.
  Added 2026-09-13.
- **Adversarial-testing revision feedback loop** — `003-judgment-pipeline-mvp`'s adversarial
  testing step (FR-031/FR-032) can detect a genuine weakness in the lead evidence and reports
  `revisionOccurred: true`, but doesn't yet feed that weakness back into a re-graded `Warrant` —
  doing so would mean re-running `gradeOrigin` with the new information, a loop this MVP doesn't
  build. For now, a human reading `revisionOccurred: true` on a ledger knows something surfaced
  that the automatic grade doesn't yet reflect. Added 2026-09-13.
- **Full Tree 2/3/4 judgment depth in the pipeline** — `003`'s `classify.ts` correctly identifies
  a claim's type (causal/predictive/complex_system/simple_factual), but only `simple_factual`
  claims get full judgment depth end to end. A causal claim's `underlyingFactualBand` (which
  properly requires evaluating a decomposed factual sub-claim first), a predictive claim's
  Established-shaped-conditions check, and a complex-system claim's decomposition are each
  genuinely separate judgment work `003`'s MVP scope didn't include — non-simple-factual claims
  currently get conservative, honestly-capped placeholder `treeExtension` values rather than full
  reasoning. Worth its own feature once `003`'s simple-factual path is validated live. Added
  2026-09-13.
- **Interactive resume for `needs_clarification`** — `004-claim-dashboard`'s dashboard requires a
  fresh submission when a run returns `needs_clarification`, rather than letting a visitor answer
  the displayed question(s) and continue the same run. Resuming needs persisted in-progress run
  state and an extension to `003`'s `remediate()` loop to accept human-supplied context it wasn't
  built for — real, wanted follow-up work once `004`'s fresh-submission version is validated live.
  Added 2026-09-14.
