# Feature Specification: Judgment Pipeline MVP

**Feature Branch**: `003-judgment-pipeline-mvp`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "The pipeline that turns a raw claim into a populated ledger for the
001 rule engine: an intake harm gate before any spend, autonomous web search and retrieval for
real sources (not just model memory), blind per-origin warrant grading, and diagnosticity marking
— using a user-supplied API key (BYOK) so the cost of running it doesn't fall on one person."

## Clarifications

### Session 2026-09-13

- Q: When the harm-gate classifier is genuinely uncertain whether a claim's subject is a public figure or whether specific conduct falls inside their public role, should uncertainty default to reject or accept? → A: Neither — route to a "needs human review" status instead of auto-deciding. The status itself just needs to be recorded somewhere durable enough to act as a queue (a simple stored record is enough for now); building the actual review/management workflow around that queue is separate follow-up work, tracked in PROJECT-TRACKER.md rather than built as part of this feature.
- Q: What should determine when autonomous source search is "done" for a claim? → A: Stop once at least 2 independent clusters worth of diagnostic evidence have been found (the protocol's own Established-tier corroboration threshold), or a fixed number of consecutive search attempts in a row find no new independent source, whichever comes first — not an arbitrary fixed target count of raw sources.
- Q: How should a paywalled source where only a search-result snippet is visible be recorded? → A: As `could_not_retrieve` — `001`'s existing forced-bare-assertion treatment for that status is already the right conservative handling for partial content; no new Origin schema state needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reject out-of-scope claims before any spend (Priority: P1) 🎯 MVP

Before any other step runs, a claim naming a private individual, targeting someone's private
life, or that isn't falsifiable-shaped is rejected immediately, with the specific rule that fired
stated back to the requester — and no API spend has occurred.

**Why this priority**: The constitution names this the single highest-consequence failure the
system can produce (a confident-sounding automated verdict about a named private person) and
requires it be "written before launch, not after an incident." Every other story in this feature
is downstream of this gate passing.

**Independent Test**: Submit a claim naming a private individual's private life; confirm it is
rejected with a stated rule and that no other pipeline step (search, retrieval, grading) ever ran.

**Acceptance Scenarios**:

1. **Given** a claim naming a private individual and their private life, **When** it is submitted,
   **Then** the pipeline rejects it, states which rule fired, and makes no further API call of any
   kind.
2. **Given** a claim about a public figure's conduct in their public role, **When** it is
   submitted, **Then** the pipeline accepts it and proceeds.
3. **Given** a claim about an institution, product, policy, or a scientific/historical/statistical
   question, **When** it is submitted, **Then** the pipeline accepts it and proceeds.
4. **Given** a claim that is not falsifiable-shaped (no observation could in principle show it
   false), **When** it is submitted, **Then** the pipeline rejects it before any further spend,
   citing that rule specifically — distinct from the private-individual rule.
5. **Given** a rejected claim, **When** the rejection is shown, **Then** it names the specific
   rule that fired, never a generic "not allowed" message.
6. **Given** a claim where the classifier is genuinely uncertain whether the subject is a public
   figure or whether specific conduct falls inside their public role, **When** it is submitted,
   **Then** the pipeline neither accepts nor rejects it — it records a "needs human review" status
   with the specific reason, and makes no further API call beyond the harm-gate check itself.

---

### User Story 2 - Bring your own key (Priority: P1) 🎯 MVP

A requester supplies their own API key for this run. The key is used only for this run's calls,
is never written to disk, logged, or transmitted anywhere except the API calls it authorizes, and
the requester — not the platform operator — bears the cost of their own run.

**Why this priority**: This is the specific requirement that makes the tool usable by anyone
other than the platform operator, carried forward from `002`'s Assumptions. Without it, every run
costs the operator money, which the platform's own funding model (read: nobody pays; request:
nobody pays; run with own key: requester pays) depends on being true.

**Independent Test**: Supply a key, run a claim through the pipeline, then inspect memory, logs,
and any written files afterward; confirm the key appears nowhere except the in-flight API calls
it authorized.

**Acceptance Scenarios**:

1. **Given** no key has been supplied, **When** a run is attempted, **Then** the pipeline refuses
   before making any API call, with a message telling the requester to supply one.
2. **Given** a key is supplied for one run, **When** that run completes, **Then** the key is not
   retained anywhere the pipeline controls — not written to disk, not logged, not attached to the
   resulting ledger or trace.
3. **Given** an invalid or expired key, **When** a run is attempted, **Then** the pipeline reports
   the authorization failure clearly, distinct from every other kind of failure this feature can
   produce (rejection, no-sources-found, grading failure).

---

### User Story 3 - Find and retrieve real sources for the claim (Priority: P1) 🎯 MVP

For a claim that has passed the harm gate, the pipeline searches the live web, identifies
candidate sources, and retrieves their actual content — not a model's memory of what such a
source might say.

**Why this priority**: The constitution requires "every factual lookup MUST be verified against
live sources at evaluation time" and that model training memory "MUST NOT serve as evidence."
Without real retrieval, nothing downstream (grading, diagnosticity) has anything legitimate to
grade — this is the step that makes the rest of the pipeline honest rather than a plausible-
sounding fabrication.

**Independent Test**: Submit an in-scope claim; confirm every resulting origin has a real,
independently-checkable URL, and that fetching that URL again independently shows content
consistent with what the pipeline recorded.

**Acceptance Scenarios**:

1. **Given** an in-scope claim, **When** the pipeline searches for sources, **Then** it returns
   one or more candidate origins, each with a real URL that resolves to actual content.
2. **Given** a candidate origin, **When** its content is fetched, **Then** the pipeline archives
   the content hash, timestamp, HTTP status, and final URL alongside it (Constitution Principle
   V) — not just the URL.
3. **Given** a candidate origin whose URL returns an error or cannot be retrieved, **When** that
   happens, **Then** the origin is recorded as `could_not_retrieve` rather than silently dropped
   or guessed at.
4. **Given** the web search returns zero usable candidates for a claim, **When** that happens,
   **Then** the pipeline produces a ledger with zero surviving origins (which the engine already
   correctly bands as Unsupported) rather than fabricating a plausible-sounding source.

---

### User Story 4 - Grade each retrieved origin blind to the claim's direction (Priority: P1) 🎯 MVP

Each retrieved origin is graded for its evidentiary warrant — bare assertion through
re-testable/physical-documentary — by a step that never sees whether the claim is true, false, or
which side this origin is being used to support.

**Why this priority**: Constitution Principle II calls blind grading "an architectural property
rather than an instruction" specifically because a model that cannot see which side evidence
supports cannot apply a double standard to it. This is the mechanism the project's credibility
with skeptics depends on — it is not optional polish on top of grading, it is what makes the
grading trustworthy at all.

**Independent Test**: Grade the same origin twice, once framed as supporting a claim and once as
opposing it (by varying only which claim is paired with it upstream, never the grading call's own
input); confirm the grading step produces identical output either way, because it never received
that information in the first place.

**Acceptance Scenarios**:

1. **Given** a retrieved origin, **When** it is graded, **Then** the grading call receives only
   the origin's content and the signalling questions (D1–D4, upgrade triggers, interested-party
   status) — never the claim text, never whether this origin supports or opposes the claim, never
   the running ledger state.
2. **Given** a grading call answers a downgrade trigger as fired, **When** it does, **Then** it
   also names the specific mechanism by which the missing safeguard could produce the claimed
   result even if the underlying claim were false (matching the protocol's requirement that a
   trigger fire only when both conditions hold).
3. **Given** an origin that cannot be retrieved and inspected, **When** it is graded, **Then** it
   is graded as bare assertion regardless of what type of source it claims to be.
4. **Given** an origin the source itself later corrected, **When** it is graded, **Then** only the
   corrected form is evaluated, per the protocol's correction-handling rule.

---

### User Story 5 - Mark each surviving line's diagnosticity against the claim (Priority: P1) 🎯 MVP

For each origin that survived grading, a step determines whether that evidence is consistent with,
inconsistent with, or not applicable to the specific claim being evaluated — the one place in the
pipeline that legitimately does see the claim, since this judgment is inherently about the
relationship between the two.

**Why this priority**: Without diagnosticity marks, `001`'s engine has no way to distinguish
evidence that actually bears on the claim from evidence that happens to exist alongside it — every
surviving line would default to ambiguous, and the resulting ledger couldn't reach any band above
Contested regardless of how strong the underlying evidence actually was.

**Independent Test**: Given a claim and a graded origin whose content plainly confirms or plainly
contradicts it, confirm the diagnosticity mark matches that relationship.

**Acceptance Scenarios**:

1. **Given** a graded, surviving origin and the claim, **When** diagnosticity is marked, **Then**
   the mark is exactly one of consistent, inconsistent, or not-applicable — never left unmarked.
2. **Given** an origin whose content is consistent with the claim, **When** marked, **Then** the
   mark is `consistent`.
3. **Given** an origin whose content directly contradicts the claim, **When** marked, **Then**
   the mark is `inconsistent`.

---

### User Story 6 - Identify at least one plausible rival explanation (Priority: P2)

The pipeline proposes a genuinely plausible alternative explanation for the claim (not a strawman)
and marks each surviving origin's diagnosticity against that rival too, so the engine's
unrebutted-rival conditions have something real to evaluate rather than defaulting to "no rivals
exist."

**Why this priority**: A ledger with no rivals is a valid input (the engine treats it as "no
unrebutted rival," which is a legitimate outcome for many claims), so this story is not required
for the pipeline to produce a usable ledger — Stories 1 through 5 already do that. But without it,
every claim this pipeline processes looks artificially uncontested, which understates the rigor
the rest of the system is built to demonstrate.

**Independent Test**: Given a claim with a well-known genuine competing explanation, confirm the
pipeline identifies that rival (or one materially similar to it) rather than only the claim's own
framing.

**Acceptance Scenarios**:

1. **Given** an in-scope claim, **When** rival identification runs, **Then** it proposes at least
   one alternative explanation distinct from the claim itself, using model reasoning to generate
   the hypothesis (permitted) without treating that reasoning as evidence in its own right
   (Constitution Principle II).
2. **Given** a proposed rival, **When** diagnosticity is marked, **Then** every surviving origin
   also receives a mark (consistent/inconsistent/not-applicable) against that rival, not only
   against the claim.

---

### User Story 7 - Adversarial testing and steelman (Priority: P3)

The pipeline deliberately attempts to falsify the claim's strongest evidence and constructs the
strongest good-faith case against the claim, recording whether the claim's support survived that
attempt.

**Why this priority**: This is what moves a ledger from "Probable" toward "Established" territory
on `001`'s Tree 1 — genuinely valuable, but the pipeline already produces an honest, usable ledger
without it (the engine correctly caps at Probable when adversarial status is `untested`, per its
own FR-021/FR-028 logic). This is a refinement of an already-working pipeline, not a blocker to
having one.

**Independent Test**: Given a claim whose lead evidence has a genuine, discoverable weakness,
confirm adversarial testing surfaces that weakness rather than reporting an unqualified "survived."

**Acceptance Scenarios**:

1. **Given** a claim that has passed grading and diagnosticity marking, **When** adversarial
   testing runs, **Then** it records `survived` or `untested` (never fabricating a pass on
   evidence never actually tested) matching `001`'s `AdversarialStatus` field.
2. **Given** adversarial testing changes the assessment, **When** it does, **Then** the resulting
   ledger's trace records that a revision occurred, per `001`'s `steelman.revisionOccurred` field.

---

### Edge Cases

- What happens when the same origin is found by two different search queries during one run —
  is it graded once or twice?
- What happens when a source is paywalled and only a snippet is retrievable — is that
  `could_not_retrieve`, or a retrieved-but-limited state?
- What happens when the supplied API key is valid but the account has hit its own rate limit or
  quota mid-run?
- What happens when a claim is genuinely ambiguous between two claim types (Step 1's low-
  confidence dual-classification case, which `001`'s engine already supports on the input side)?
- What happens when the web search tool itself returns results, but every one of them turns out to
  be another aggregator or repetition of the same original source rather than an independent one?

## Requirements *(mandatory)*

### Functional Requirements

**Harm gate (User Story 1)**

- **FR-001**: System MUST run a pre-flight classifier on every submitted claim before any other
  API call is made.
- **FR-002**: System MUST reject a claim that names a private individual or targets a person's
  private life. When the classifier is genuinely uncertain whether the subject is a public figure
  or whether specific conduct falls inside their public role — a real borderline case, not a
  clear rule violation — the claim MUST NOT be auto-accepted or auto-rejected; it MUST be routed
  to a distinct "needs human review" status instead (see FR-002a).
- **FR-002a**: A claim routed to "needs human review" MUST be recorded with the claim text and the
  specific reason review is needed, in a store durable enough to survive the pipeline run ending —
  this feature is responsible only for producing and recording that status; the review/management
  workflow that acts on the queue is separate, out-of-scope follow-up work (tracked in
  PROJECT-TRACKER.md).
- **FR-003**: System MUST reject a claim that is not falsifiable-shaped — no observation could in
  principle show it false.
- **FR-004**: System MUST accept a claim about a public figure's conduct in their public role,
  about institutions, products, or policies, or of a scientific, historical, or statistical
  nature.
- **FR-005**: Every rejection MUST state the specific rule that fired. A generic refusal without a
  named rule is non-compliant.
- **FR-006**: No step after the harm gate MUST execute for a rejected claim — rejection MUST be a
  hard stop, not a soft warning that later steps proceed past anyway.

**Bring your own key (User Story 2)**

- **FR-007**: System MUST require a caller-supplied API key before making any API call; it MUST
  NOT fall back to an operator-owned key.
- **FR-008**: System MUST NOT write the supplied key to disk, to logs, to the produced ledger, or
  to any trace/run record.
- **FR-009**: System MUST use the supplied key only for the run it was supplied for; nothing in
  this feature persists it for reuse across runs.
- **FR-010**: System MUST distinguish an authorization failure (invalid/expired/rate-limited key)
  from every other failure category this pipeline can produce, in the message reported back.

**Autonomous source discovery and retrieval (User Story 3)**

- **FR-011**: System MUST search the live web for sources relevant to an in-scope claim; it MUST
  NOT substitute the model's own training-time memory for a live source. Search effort MUST stop
  once either (a) at least 2 independent clusters worth of diagnostic evidence have been found —
  the protocol's own Established-tier corroboration threshold, not an arbitrary count — or (b) a
  fixed number of consecutive search attempts in a row find no new independent source, whichever
  comes first.
- **FR-012**: System MUST retrieve the actual content of each candidate source, not only a search
  snippet, wherever the source allows retrieval.
- **FR-013**: System MUST record, for every fetch attempted: content hash, timestamp, HTTP status,
  and final URL (Constitution Principle V) — regardless of whether the fetch succeeded.
- **FR-014**: A source that cannot be retrieved and inspected — including a paywalled source where
  only a search-result snippet is visible, not the full content — MUST be recorded as
  `could_not_retrieve`, never silently omitted and never guessed at from its URL, title, or
  snippet alone. This reuses `001`'s existing forced-bare-assertion treatment for that status
  rather than introducing a new partial-retrieval state.
- **FR-015**: A claim for which zero usable sources are found MUST still produce a valid ledger —
  with zero surviving origins — rather than the pipeline fabricating a source to avoid an
  Unsupported result.
- **FR-016**: System MUST NOT invent a source that does not actually exist at a real, resolvable
  URL.

**Fetched content containment (cross-cutting; Constitution Principle V)**

- **FR-017**: Retrieved content MUST reach every judgment step (grading, diagnosticity, rival
  generation) only inside a delimited, explicitly-untrusted data block — never in a position a
  step could interpret as an instruction to itself.
- **FR-018**: Any judgment step MUST report, as a distinct finding, whenever a retrieved source
  contains embedded directive-shaped content (e.g., text addressed to an AI system), rather than
  silently complying with or silently ignoring it.
- **FR-019**: A step's own output MUST be checked for whether it echoes instruction-shaped content
  from a source, so an injection attempt is detected rather than merely contained.

**Blind per-origin warrant grading (User Story 4)**

- **FR-020**: The warrant-grading step MUST receive only an origin's content and the grading
  signalling questions (D1–D4, upgrade triggers, interested-party status per
  AGENT-PROTOCOL-v3.md Step 3) — it MUST NOT receive the claim text, whether this origin supports
  or opposes the claim, or the running ledger state.
- **FR-021**: A downgrade trigger MUST fire only when both a safeguard is missing AND the specific
  mechanism by which that missing safeguard could produce the claimed result (even if false) can
  be named; that mechanism MUST be recorded alongside the fired trigger.
- **FR-022**: An origin that cannot be retrieved and inspected MUST be graded as bare assertion
  regardless of what type of source it claims to be.
- **FR-023**: A retracted origin's grading MUST remove its entire downstream line; a corrected
  origin MUST be graded only in its corrected form.
- **FR-024**: The pipeline's warrant grades MUST map onto `001`'s existing four-level
  `WarrantGrade` scale (`assertion` / `testimony` / `contemporaneous_record` /
  `physical_documentary`) — the protocol's top two tiers (re-testable/reproducible, and
  physical/documentary record) both map to `physical_documentary`, matching how `001` already
  treats that combined tier in its extraordinary-claim logic.
- **FR-025**: An upgrade trigger MUST be verified against an actual demonstrated property (e.g. a
  real independent replication that is itself retrievable), never presumed from a source's
  reputation, and MUST NOT move a grade above `physical_documentary`.

**Diagnosticity marking (User Story 5)**

- **FR-026**: Every surviving graded origin MUST receive exactly one diagnosticity mark against
  the claim: consistent, inconsistent, or not-applicable.
- **FR-027**: The diagnosticity-marking step MAY receive the claim text (unlike the grading step)
  since this judgment is inherently about the relationship between evidence and claim.

**Rival identification (User Story 6)**

- **FR-028**: System MUST propose at least one plausible alternative explanation for an in-scope
  claim, distinct from the claim's own framing.
- **FR-029**: A proposed rival generated from model reasoning MUST be treated as a hypothesis to
  test, never as evidence in its own right (Constitution Principle II's "model training memory MAY
  generate hypotheses... MUST NOT serve as evidence").
- **FR-030**: Every surviving origin MUST also receive a diagnosticity mark against each proposed
  rival, using the same three-value scale as FR-026.

**Adversarial testing and steelman (User Story 7)**

- **FR-031**: System MUST record the claim's adversarial-testing status as `survived` or
  `untested`, matching `001`'s `AdversarialStatus` field — it MUST NOT report `survived` for
  evidence that was never actually tested.
- **FR-032**: When adversarial testing or the steelman step changes the assessment reached before
  it ran, the resulting ledger MUST record that a revision occurred.

**Output and trace (cross-cutting)**

- **FR-033**: The pipeline's final output MUST be a `LedgerInput` matching `001`'s existing schema
  exactly — no additional fields, no missing required fields — so `001`'s `evaluate()` accepts it
  without a `refusalReason`.
- **FR-034**: Every run MUST stamp which model(s) performed each step (Constitution Principle III's
  `model_ids`), independent of the engine's own `engineVersion`/`schemaVersion` stamps.
- **FR-035**: Every run MUST be attributable to a specific run and requester (Constitution
  Principle III), even though this feature does not itself provide persistent public storage for
  that record (see Assumptions).
- **FR-036**: Deterministic re-validation of an origin from its archived snapshot (content hash,
  timestamp, status, URL — FR-013) MUST be possible without a live re-fetch, satisfying
  Constitution Principle V's offline-revalidation requirement.
- **FR-036a**: System MUST classify the claim's type (simple_factual / causal / predictive /
  complex_system, per AGENT-PROTOCOL-v3.md Step 1) and the extraordinary-claim flag, since `001`'s
  `LedgerInput.classification`/`screens.priorPlausibility` fields require both and no other FR in
  this spec assigns a step to producing them. (Surfaced during implementation — the original spec
  covered the harm gate's falsifiability rejection but not the ledger's own classification step.)

**Structural registry classification (cross-cutting; Constitution Principle VI)**

- **FR-037**: System MUST classify each retrieved origin's domain against a structural registry of
  known classes (aggregator, press_release, preprint, paywalled) before grading it.
- **FR-038**: An origin classed as an aggregator MUST be traced through to the original source it
  repeats (per AGENT-PROTOCOL-v3.md Step 3's derivative-artifacts rule) rather than graded as if it
  were itself the source; if the original cannot be found, the aggregator's content is graded as
  whatever it actually is (typically assertion or testimony), never inflated to the grade the
  original might have carried.
- **FR-039**: The registry itself MUST be reviewable, versioned, curated data — not a per-run
  judgment call the grading step invents fresh each time — matching Constitution Principle VI's
  "structural registry classes... are curated, definitional config."

### Key Entities

- **Run**: One end-to-end pipeline execution for one claim: the supplied claim text, the
  requester's key (used, never retained), the harm-gate outcome (accept / reject /
  needs-human-review, with a reason recorded for the latter two), and — if accepted — the
  resulting `LedgerInput` and the model-id/timestamp trace for each step.
- **Candidate Origin**: A source found by web search before retrieval is attempted; becomes an
  `Origin` (per `001`'s schema) once retrieval has been attempted, successful or not.
- **Fetch Record**: The content hash, timestamp, HTTP status, and final URL archived for one
  retrieval attempt (Constitution Principle V) — exists even when retrieval failed.
- **Grading Call**: One invocation of the blind warrant-grading step for one origin — receives
  only the origin's content and the signalling questions, never the claim or ledger state.
- **Rival Hypothesis**: A model-generated alternative explanation for the claim, used as something
  to test diagnosticity against, never treated as evidence.
- **Registry Entry**: A curated, versioned mapping from a domain to a structural class
  (aggregator, press_release, preprint, paywalled) — reviewed data, never a fresh per-run guess.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of claims naming a private individual's private life are rejected before any
  API call beyond the harm-gate check itself.
- **SC-002**: 100% of rejections state a specific, named rule — zero generic refusals.
- **SC-003**: 0 supplied API keys are found in any log, file, or output the pipeline produces,
  checked after a run completes.
- **SC-004**: 100% of ledgers this pipeline produces are accepted by `001`'s `evaluate()` with no
  `refusalReason`.
- **SC-005**: 100% of origins in a produced ledger have either a real, independently-resolvable
  URL or a `could_not_retrieve` status — 0% fabricated or unverifiable sources.
- **SC-006**: 100% of graded origins can be shown, by inspecting the grading call's actual input,
  to have never received the claim text or direction.
- **SC-007**: A claim with zero discoverable sources produces a valid, zero-origin ledger 100% of
  the time, never a fabricated one.
- **SC-008**: 100% of borderline harm-gate cases are routed to "needs human review" rather than
  auto-accepted or auto-rejected, with the specific reason recorded in every case.
- **SC-009**: 0 origins classed as an aggregator in the registry are graded as if they were the
  original source, checked against every produced ledger.

## Assumptions

- This feature depends on `001-rule-engine-core`'s `LedgerInput` schema and `evaluate()` function
  as its contract; it does not modify either.
- Persistent, publicly-hosted storage of runs (the database, migrations, and the stored-run
  format satisfying the full Constitution Principle III public/contestable surface) is a separate,
  future feature — matching `001`'s own Assumptions that persistence is out of scope for the
  engine. This feature's own run trace (FR-034/FR-035) and fetch archival (FR-013/FR-036) exist
  regardless, satisfying Principle V's containment requirement even before a database exists to
  store them long-term; where they're written to in the meantime is a plan-level decision, not
  fixed here. The one exception is the "needs human review" queue (FR-002a): it needs a durable
  record from the moment this feature ships, since a review queue that doesn't survive the process
  exiting isn't a queue — but building the workflow that manages that queue is separate follow-up
  work, tracked in PROJECT-TRACKER.md rather than this feature's own scope.
- Web search and retrieval are performed through whatever mechanism the chosen model provider
  makes available for grounding a response in live search results — the specific mechanism is a
  plan-level decision, not fixed in this spec.
- BYOK means a caller-supplied key for whichever model provider the plan phase selects; this spec
  does not name a specific provider.
- This feature has no user interface of its own beyond however the plan phase chooses to expose
  "submit a claim, supply a key, get a ledger" — it may be a CLI, a library function `002`'s UI
  calls, or a new UI surface; that choice belongs to `/speckit-plan`, not this spec.
- The claim-scope policy this feature's harm gate enforces (private individual / private life /
  not falsifiable-shaped / accept public-figure-public-conduct, institutions, products, policies,
  science/history/statistics) is already decided at the platform-brief level (§12) — this feature
  implements it, it does not redesign it.
- The structural registry (FR-037–FR-039) ships as a small, seed set of well-known aggregator/
  press-release/preprint/paywalled domains for this MVP, not a comprehensive or actively-curated
  system — expanding and maintaining it is reasonable future follow-up work, not a blocker to
  this feature functioning correctly on the domains it does know about.
