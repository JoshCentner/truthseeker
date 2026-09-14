# Feature Specification: Claim Dashboard

**Feature Branch**: `004-claim-dashboard`

**Created**: 2026-09-14

**Status**: Draft

**Input**: User description: "An HTML dashboard for Josh and others to submit a claim and view its
output — the LLM populates dashboard content via the pipeline's structured API rather than free
text, deterministic validation checks that output, and failures surface as clarifying questions —
building on 003's harm gate, BYOK, and bounded-remediation loop rather than duplicating any of it."

## Clarifications

### Session 2026-09-14

- Q: When a `needs_clarification` result comes back, should the visitor be able to answer the displayed question(s) and have the same run continue, or should they always submit a fresh claim from scratch? → A: Fresh submission for this feature — no changes to `003`, no persisted in-progress run state needed. Interactive resume (pausing a run and continuing it once answered) is real, wanted follow-up work, tracked in PROJECT-TRACKER.md rather than built now, since it requires exactly the persisted-state machinery this spec's own Assumptions say doesn't exist yet.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit a claim and see whatever outcome results, clearly (Priority: P1) 🎯 MVP

A visitor — Josh or someone else — submits a claim and their own API key, and sees the outcome
displayed plainly: a computed verdict, a rejection, a needs-review notice, or a
needs-clarification notice — never a raw crash, an unexplained blank state, or JSON dumped on
screen.

**Why this priority**: This is the entire point of a dashboard — `003` already produces all four
outcomes correctly, but today the only way to see one is to read raw JSON from a CLI. Every other
story in this feature is a refinement of how well this one outcome is presented.

**Independent Test**: Submit a claim known to produce each of `003`'s four outcome kinds; confirm
each is displayed in a form appropriate to it, never as an unhandled error.

**Acceptance Scenarios**:

1. **Given** a claim that completes successfully, **When** the run finishes, **Then** the
   dashboard shows the resulting band and its full trace, not raw JSON.
2. **Given** a claim the harm gate rejects, **When** that happens, **Then** the dashboard shows
   the specific rule that fired, not a generic error.
3. **Given** a claim routed to `needs_review`, **When** that happens, **Then** the dashboard shows
   that it's pending human review and why, distinct from both a rejection and a completed result.
4. **Given** a step that exhausts its remediation attempts (`needs_clarification`), **When** that
   happens, **Then** the dashboard shows the specific unresolved question(s), not a generic
   failure message.

---

### User Story 2 - Provide your own API key, used only for that submission (Priority: P1) 🎯 MVP

A visitor enters their own API key alongside their claim. The key is used only to authorize that
one run and is never exposed to the browser's own network traffic in a way third parties could
observe, never logged, and never persisted anywhere.

**Why this priority**: This is `003`'s FR-008/FR-009 requirement extended into a request/response
context — a key typed into a web form is a more exposed surface than a CLI environment variable,
so getting this wrong here is a materially bigger risk than getting it wrong in `003`'s CLI.

**Independent Test**: Submit a claim with a key; inspect the browser's own network requests and
the dashboard's own logs/storage afterward; confirm the key appears in neither.

**Acceptance Scenarios**:

1. **Given** a visitor submits a claim without a key, **When** they try, **Then** the dashboard
   asks for one before attempting anything, never silently falling back to an operator-owned key.
2. **Given** a key is submitted, **When** the run completes or fails, **Then** the key is not
   retained anywhere the dashboard controls.
3. **Given** the key itself is invalid or expired, **When** that happens, **Then** the dashboard
   shows that distinctly from every other outcome (matching `003`'s `auth_failed`).

---

### User Story 3 - Watch live progress while a claim is processed (Priority: P1) 🎯 MVP

Since a real run takes real wall-clock time (multiple minutes, per `003`'s own scope), a visitor
sees which step is currently running rather than staring at a blank or frozen page with no
indication anything is happening.

**Why this priority**: `003`'s trace already records which step ran when — this story is about
surfacing that during the run, not only after it. Without it, a multi-minute wait looks
indistinguishable from a hang, which is a materially worse experience than a dev CLI printing
nothing until it's done.

**Independent Test**: Submit a claim; confirm the displayed step advances (harm gate → classify →
search → retrieve → grade → rivals → diagnosticity → adversarial → assemble) as the real run
progresses, not just a static spinner.

**Acceptance Scenarios**:

1. **Given** a run in progress, **When** a step completes, **Then** the dashboard's displayed
   progress advances to name the next step running.
2. **Given** a run that hits a remediation retry on some step, **When** that happens, **Then**
   the dashboard does not misreport the step as stuck or failed — a retry is still progress on
   that step, not an error state.

---

### User Story 4 - See the full evidence trail in plain language (Priority: P2)

For a completed verdict, a visitor can see every source used, its warrant grade and why, its
relationship to the claim, and every condition that produced or capped the final band — presented
as readable prose and structured lists, not a dump of `001`'s internal field names.

**Why this priority**: `002`'s dev UI already displays this trace faithfully for a developer
audience; this story is about making the same underlying data legible to the non-technical
audience this dashboard is explicitly for ("for people," not just Josh). It's a refinement of
User Story 1's display, not a new data requirement — everything needed is already in the
`Verdict`/`LedgerInput` `003` produces.

**Independent Test**: Given a completed verdict with multiple origins of different grades, confirm
a non-technical reader can determine, from the dashboard alone, which sources supported the
claim, which didn't, and why the band landed where it did.

**Acceptance Scenarios**:

1. **Given** a completed verdict, **When** displayed, **Then** every origin's URL, its warrant
   grade, and its diagnosticity mark against the claim are all shown together, not scattered
   across unrelated sections.
2. **Given** a capping condition on the verdict, **When** displayed, **Then** it's rendered as a
   plain-language explanation of what would need to be true for a higher band, not the raw
   protocol-clause string alone.

---

### Edge Cases

- What happens if the browser tab is closed or the connection drops mid-run? The run itself is a
  server-side process (User Story 2's key-safety requirement already implies this) — does it keep
  running, and can the visitor reconnect to see the eventual result, or is the run lost?
- What happens when two visitors submit claims at the same time? Each visitor's key and progress
  must stay isolated from every other visitor's — one person's run must never show up on another
  person's screen.
- What happens on a `needs_clarification` outcome — can the visitor supply the missing information
  and have the same run continue, or must they submit a fresh claim from scratch?
- What happens when a claim takes unusually long (well beyond a typical few minutes)? Does the
  visitor get any indication of how much longer to expect, or just an indefinitely advancing
  progress state?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept a claim and an API key from a visitor and use `003`'s existing
  pipeline unmodified to process them — this feature MUST NOT reimplement or approximate any
  harm-gate, grading, or banding logic.
- **FR-002**: System MUST display each of `003`'s four outcome kinds (`completed`, `rejected`,
  `needs_review`, `needs_clarification`) in a form specific to that outcome, never a generic
  success/failure binary.
- **FR-003**: The visitor's API key MUST be used only server-side to authorize that one run. It
  MUST NOT be embedded in any client-side code or exposed in any network request the browser's own
  devtools could observe beyond the single submission itself, and MUST NOT be logged or persisted
  anywhere (extending `003`'s FR-008/FR-009 into this feature's request/response boundary).
- **FR-004**: System MUST require a key before attempting a run; it MUST NOT fall back to an
  operator-owned key under any circumstance.
- **FR-005**: System MUST surface which step of the pipeline is currently running while a run is
  in progress, updating as the run advances through `003`'s step sequence.
- **FR-006**: A remediation retry on a step MUST NOT be displayed as an error or a stalled state —
  progress display MUST distinguish "this step is retrying" from "this step failed."
- **FR-007**: For a `completed` result, System MUST display the band, every condition met, every
  capping condition (in plain language, not only the raw protocol-clause string), and every
  origin's URL, warrant grade, and diagnosticity mark against the claim.
- **FR-008**: For a `rejected` result, System MUST display the specific rule that fired (`003`'s
  FR-005), never a generic refusal message.
- **FR-009**: For a `needs_review` result, System MUST display that the claim is pending human
  policy review and the specific reason, distinct from a `needs_clarification` result.
- **FR-010**: For a `needs_clarification` result, System MUST display the specific step and
  question(s) that remain unresolved (`003`'s FR-044), distinct from a `needs_review` result. A
  visitor resolves this by submitting a fresh claim with the missing information included — this
  feature does not pause and resume the same run (see Assumptions and PROJECT-TRACKER.md for the
  deferred interactive-resume capability).
- **FR-011**: Each visitor's submission, progress, and result MUST be isolated from every other
  concurrent visitor's — one visitor's key, claim, or progress MUST NOT be observable to another.

### Key Entities

- **Submission**: One visitor's in-flight or completed request — the claim text, whether a key was
  supplied (never the key's value, once the run starts using it), the current or final
  `PipelineResult`, and the currently-running step while in progress.
- **Progress Update**: A single "this step is now running / retrying / complete" event surfaced to
  the visitor while their submission is in flight.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of `003`'s four outcome kinds are displayed in a form specific to that outcome,
  verified by submitting a claim engineered to produce each one.
- **SC-002**: 0 supplied API keys are observable in the browser's own network tab beyond the single
  submission request, and 0 appear in any log or storage the dashboard controls, checked after a
  real run.
- **SC-003**: A visitor can tell, without prior explanation, which step of the pipeline is
  currently running at any point during a multi-minute run, within a few seconds of that step
  actually starting.
- **SC-004**: A non-technical reader can correctly identify, from a completed verdict's dashboard
  display alone, at least one supporting and one non-supporting piece of evidence when both exist.
- **SC-005**: Two concurrent submissions from different visitors never cross-contaminate — each
  visitor sees only their own progress and result.

## Assumptions

- This feature runs `003`'s pipeline exactly as built — the harm gate, BYOK, bounded remediation,
  and all seven judgment steps are inherited unmodified, not extended or re-specified here.
- Per Constitution architecture guidance ("the pipeline MUST NOT be hosted before public BYOK runs
  require it"), this feature does not itself require standing up a public hosted deployment to be
  complete — it must work for a visitor running it themselves (locally, or on infrastructure they
  provide), the same self-hosted BYOK model `003` already assumes. Whether and when to host a
  public instance is a separate, later decision.
- No persistence exists yet (matching `001`/`002`/`003`'s own deferrals) — a completed result is
  not expected to be shareable via a permalink or revisitable after the browser session ends. That
  capability depends on the future persistence feature all three prior features already deferred
  to.
- Live progress requires *some* mechanism for the server to push step updates to the browser during
  a multi-minute run (a live connection, polling, or similar) — the specific mechanism is a
  plan-level decision, not fixed here.
- Running the pipeline server-side (never in a browser context) is inherited directly from `003`'s
  own Technical Context, which already established this as a hard security constraint, not a new
  decision this feature is making.
- A `needs_clarification` result requires a fresh submission, not an interactive resume of the
  same run (see Clarifications above). Interactive resume is real follow-up work, tracked in
  PROJECT-TRACKER.md, deferred because it needs persisted in-progress run state this feature
  doesn't build.
