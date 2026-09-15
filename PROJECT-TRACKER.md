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
- **Gemini free tier no longer covers Search grounding** — blocks `003`'s quickstart Part 2 as
  written. `gemini-2.5-flash` now returns 404 for accounts created after its cutoff, and grounded
  calls on every current 3.x Flash model return 429 `RESOURCE_EXHAUSTED` on a free-tier key; per
  Google's pricing page, free-tier grounding existed only for Gemini 2.5 (500 RPD) while 3.x
  grounding is paid-tier (with 5,000 free searches/month once billing is enabled). research.md §1's
  premise that a Flash-tier model is "most likely to stay inside Gemini's free tier" no longer
  holds, and research.md should be amended when someone next touches it. `tools/manual-run/` is the
  keyless interim path. Added 2026-09-15.
- **Engine 0.2.0 needs methodology review before merge** — the Tree 1 changes described under
  Resolved below are a methodology change, not app code, and the constitution requires them to go
  through methodology review separately from ordinary code review. Specifically worth a reviewer's
  attention: (a) the refutation bar is set by mirroring Established's own floors (2+ opposing
  clusters, best opposing grade >= contemporaneous_record, no strong silence) — that is a judgement
  call about how much it should take to call something false, and it is the single most
  consequential number in the change; (b) refutation deliberately does NOT require
  `adversarialStatus === 'survived'`, on the grounds that the field describes the claim-supporting
  lead rather than the counter-evidence, which leaves counter-evidence untested by the steelman;
  (c) `nonDiagnostic` still only fires for claim-supporting lines, so there is no symmetric notion
  of an opposing line that fails to discriminate. Added 2026-09-15.

## Resolved

- **Ledger had no representation of contrary evidence** — RESOLVED in engine 0.2.0, 2026-09-15,
  pending methodology review (see Open). `src/normalize/diagnosticity.ts` marked a line
  `nonDiagnostic` only when its claim mark was `consistent`, so lines marked `inconsistent` counted
  toward `clusterCount`, the corroboration threshold gating Probable and Established. A ledger for
  "The Earth is flat." whose every line contradicted the claim computed to **`established`**.
  `src/trees/tree1-simple-factual.ts` now splits surviving diagnostic lines by their claim mark:
  only `consistent` lines corroborate, `inconsistent` lines form an opposing side with their own
  cluster count and grade, and `not_applicable` lines corroborate neither. Refuted became reachable
  from counter-evidence rather than only from a retracted origin, on a bar mirroring Established's.
  FR-034's conflicting-evidence branch, previously documented as unreachable, now fires. A claim can
  no longer be Established while any surviving diagnostic line contradicts it. Five fixtures lock
  the behaviour in (`tree1-refuted-by-counter-evidence`, `tree1-unsupported-counter-below-bar`,
  `tree1-contested-conflicting-evidence`, `tree1-not-applicable-never-corroborates`,
  `tree1-counter-evidence-blocks-established`), and `tools/manual-run/probes/contrary-evidence.mts`
  reproduces the original failure. The live Great Wall record moved `contested` -> `refuted` as a
  result.
- **Causal claims paid full price to consult evidence that could not reach the verdict** — MITIGATED
  2026-09-15; the underlying limitation is still open above under "Full Tree 2/3/4 judgment depth".
  `evaluateTree2`, `evaluateTree3` and `evaluateTree4` each receive only their `treeExtension` and
  never touch the normalized ledger, and `assemble-ledger.ts` supplies a fixed extension for every
  non-simple-factual claim, so the band for such a claim is a constant. `run-pipeline.ts` now skips
  search, retrieval, grading, rivals, diagnosticity and adversarial testing for those claims and
  stamps `skip-evidence-steps:<type>` in the trace, so the omission is visible rather than silent.
  This saves the spend and stops the trace implying judgment that did not happen; it does not give
  causal claims real depth. `tools/manual-run/probes/causal-band-is-constant.mts` keeps the
  constant-band property checkable. Remove the branch when real Tree 2/3/4 depth lands.
- **Retrieval accepted cookie walls and consent interstitials as content** — RESOLVED 2026-09-15.
  `retrieve.ts` treated any 2xx as retrieved and matched only subscription wording, so a live fetch
  of `https://pubmed.ncbi.nlm.nih.gov/30831578/` (HTTP 203, body "Cookies must be enabled") was
  recorded as `retrievalStatus: 'retrieved'` and handed to the grader as if it were the study. Wall
  detection now measures VISIBLE TEXT length rather than raw bytes — that page was 5,565 bytes of
  markup carrying about a hundred readable characters, so no raw-length threshold could separate it
  from a short article — and covers consent gates, script requirements and bot checks alongside
  paywalls. `fetch.succeeded` deliberately still records HTTP success; withholding the content is
  what flips `retrievalStatus`, which is the field that carries "we do not have this source".
- **`pickLeadOrigin` ignored diagnosticity** — RESOLVED 2026-09-15. `adversarial.ts` chose the
  "strongest surviving evidence" by warrant grade alone, so the Great Wall run steelmanned a NASA
  instrument image marked `not_applicable` against the claim while the two lines that bore on it
  went untested. Selection is now by bearing first, then grade; `runAdversarialTest` takes the
  diagnosticity outputs to do it. On re-run the step correctly targets the optometry paper instead.
- **`steelman.performed` contradicted `revisionOccurred`** — RESOLVED 2026-09-15.
  `assemble-ledger.ts` derived `performed` from `adversarialStatus !== 'untested'`, but
  `adversarial.ts` sets `untested` precisely when the test ran and found something, so both live
  records read `{ performed: false, revisionOccurred: true }`. `AdversarialOutput` now carries an
  explicit `performed` flag reported by the step itself.
- **Verdicts labelled terminal findings as capped bands** — RESOLVED 2026-09-15.
  `src/verdict/assemble.ts` attached `CAP-UNSPECIFIED` ("band below the tree's ceiling with no
  capping condition recorded") to any below-ceiling band with no capping conditions, which included
  every Refuted, Unsupported, Unresolvable and Unfalsifiable result. Those are determinations, not
  bands held down by something, and mislabelling them degrades exactly the trace Principle III
  requires to be accurate. They are now exempt.
