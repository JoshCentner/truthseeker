# Feature Specification: Engine 0.3.0 — Tree 1 Refutation per Protocol, Doubtful Reachable, Symmetric Steelman

**Feature Branch**: `006-tree1-refutation-doubtful` *(no branch created — no `before_specify` git hook is registered in this repo)*

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Engine 0.3.0: Tree 1 refutation per protocol, Doubtful reachable, and a symmetric steelman of counter-evidence. This feature implements the four rulings of the 2026-09-17 methodology review of engine 0.2.0 (PROJECT-TRACKER.md, Resolved, 'Engine 0.2.0 methodology review'; TASKS.md F-16). It is a methodology change under the constitution's Development Workflow section and touches Principles I, II and IV..."

## Why this feature exists

Engine 0.2.0 made a claim refutable by counter-evidence for the first time. The methodology
review of that change (recorded in `PROJECT-TRACKER.md`, Resolved, 2026-09-17) found that the
engine's rule did not match the protocol it is required to reproduce, that a band the protocol
defines was unreachable, and that the mirror rule — the same standard on both sides — was not
honoured on the refutation path. This feature brings the engine back to the protocol text and adds
the one thing the protocol itself lacks: a stress test of the contrary evidence before it is
allowed to refute.

This is a **methodology change**, not application code. Under the constitution's Development
Workflow section it goes through methodology review separately from ordinary code review, and the
fixture suite is its merge gate. The four rulings this feature implements were made by the project
owner; this document turns them into requirements a reviewer can diff against the engine line by
line.

### The protocol text this feature implements (quoted verbatim)

From `AGENT-PROTOCOL-v3.md`, Decision trees, **Tree 1 - Simple factual**:

> - Established: 2+ independent clusters; at least one at contemporaneous-record or better after
>   modifiers; no unrebutted rival; no strong silence finding; adversarial Survived. EXTRAORDINARY
>   claims additionally need one re-testable/physical cluster.
> - Probable: 2+ clusters with the best at contemporaneous-record or better; OR one physical/
>   re-testable cluster; OR 2+ independent testimony clusters recorded before the dispute existed
>   (pre-dispute fixing is the discriminator; post-dispute testimony cannot carry above Contested at
>   any volume, though it corroborates). Plus: no unrebutted rival more plausible than the claim;
>   adversarial Survived or Untested.
> - Contested - conflicting: diagnostic evidence both sides at comparable grade and count.
> - Contested - insufficient: a single post-dispute testimony cluster as sole support; or all
>   surviving evidence non-diagnostic; or an unrebutted comparable rival with thin evidence on both
>   sides.
> - Doubtful: contrary diagnostic evidence outweighs support on grade or count; or an unexplained
>   strong silence finding.
> - Unsupported: nothing survives at any weight.
> - Refuted: load-bearing origin retracted or fabricated; decisive contrary physical/re-testable
>   cluster; or adversarial Failed on the load-bearing evidence.

From the **Bands** section:

> - Unsupported: nothing survives the pipeline at any weight. Zero decision weight; do not repeat
>   as fact. Not Refuted: Refuted is a falsity finding on evidence, Unsupported is a burden finding.
>   Produce evidence and the claim re-enters.
> - Refuted: affirmatively shown false, or load-bearing evidence collapsed (retraction,
>   fabrication, decisive contrary evidence).

From **Step 7 - Adversarial history**:

> Output one of: **Survived** (who, when, what happened) / **Failed** (feeds Refuted/Doubtful) /
> **Untested** (valid and informative: caps the maximum band at Probable, because Established
> requires survived adversarial testing).

From **Steelman (mandatory, before any band)**:

> Construct the strongest available case against the claim: best rival, strongest contrary
> evidence, sharpest attack on the load-bearing cluster.

### The four rulings

| Ruling | Decision | What it changes |
|---|---|---|
| (a) Refutation bar | Follow the protocol text | Refuted-from-evidence needs one decisive opposing cluster at the physical/re-testable grade — not 0.2.0's two clusters at contemporaneous-record. |
| (b) Doubtful | Make it reachable | Opposition that outweighs support on grade or count lands at Doubtful, as the protocol says, not at Contested-insufficient. |
| (c) Symmetric steelman | Block until built | Refuted-from-evidence additionally requires the contrary evidence to have survived a steelman *for* the claim. The protocol gains that step; the record gains a field; until the pipeline populates it, counter-evidence caps at Doubtful. |
| (d) Non-diagnostic asymmetry | Accepted, no change | A supporting line must beat live rivals to count; an opposing line counts against the claim on its own. This is the burden of proof, not a gap. |

## Clarifications

### Session 2026-09-18

- Q: The protocol's Doubtful clause has a second half — "or an unexplained strong silence finding" — which 0.2.0 never reaches. In scope? → A: Yes. The whole Doubtful clause is implemented; strong silence caps at Doubtful (FR-015).
- Q: Protocol Step 7 outputs Survived/Failed/Untested and Tree 1's Refuted clause includes "adversarial Failed on the load-bearing evidence", but the existing adversarial status holds only survived/untested. Add failed now? → A: Yes, and it reaches Refuted, since the schema is being bumped anyway (FR-020).
- Q: What does the counter-steelman step receive? → A: The mirror of the existing adversarial step — claim text plus the strongest opposing origin's archived content as untrusted data; never the ledger, other origins, grades or rivals (FR-030).

### Session 2026-09-19

- Q: When no supporting evidence survives but contrary evidence survives below the refutation bar, which band — Unsupported (burden) or Doubtful (evidential)? → A: Doubtful, carrying a mandatory qualifier that records the burden state (the pattern Contested already uses), so neither axis is lost. Unsupported is reserved for nothing surviving on either side. The engine's band ordering, which placed Doubtful above Contested, is corrected to the protocol's sequence in the same feature (FR-011a–c, FR-038).
- Q: What may set the adversarial status to failed, the route that refutes a claim via its own lead evidence? → A: Only a cited, retrievable record of a real-world serious attempt in which the lead evidence did not hold up; the record must itself be an origin in the ledger. A model's own steelman may at most yield untested with the weakness recorded on the trace (FR-020a, FR-020b).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A methodology reviewer confirms the engine matches the protocol (Priority: P1)

A reviewer opens the engine's Tree 1 logic beside the protocol's Tree 1 clauses and checks each
band's conditions against the text. For every band the engine can reach, they find the clause it
implements quoted in the recorded condition; for every clause in the protocol, they find the
engine path that implements it. Where 0.2.0 had a refutation rule with no protocol source, they now
find the protocol's own rule. Where the protocol defines Doubtful, they now find an engine path that
reaches it.

**Why this priority**: Constitution Principle I says the engine is the only thing that may name a
band, and the Development Workflow says the fixture suite must verify "the engine reproduces the
bands the spec requires." An engine that quietly diverges from the spec breaks that chain — the
verdict is deterministic but it is determined by the wrong rule. Everything else in this feature
follows from the engine being right.

**Independent Test**: With no network and no credentials, run the fixture suite. Every Tree 1
fixture names the protocol clause it exercises; every fixture passes; the fixtures listed in
FR-023 exist and encode the bands this spec requires.

**Acceptance Scenarios**:

1. **Given** a ledger with one opposing cluster whose best grade is physical/re-testable, the
   contrary evidence marked as having survived its steelman, **When** the engine
   evaluates it, **Then** the band is Refuted and the recorded condition quotes "decisive
   contrary physical/re-testable cluster".
2. **Given** the same ledger but with two opposing clusters whose best grade is
   contemporaneous-record (the 0.2.0 bar), **When** the engine evaluates it, **Then** the band is
   NOT Refuted; it is Doubtful, and the recorded capping condition states that the opposing evidence
   is below the physical/re-testable grade the protocol requires.
3. **Given** a ledger where opposing evidence outweighs supporting evidence on grade or on cluster
   count but no opposing cluster reaches the physical/re-testable grade, **When** the engine
   evaluates it, **Then** the band is Doubtful with the qualifier outweighed, and the recorded condition
   quotes "contrary diagnostic evidence outweighs support on grade or count".
4. **Given** a ledger where opposing and supporting evidence match on both grade and count,
   **When** the engine evaluates it, **Then** the band is Contested with the conflicting-evidence
   qualifier, exactly as in 0.2.0.
5. **Given** a ledger where opposing evidence is present but weaker than the support, **When** the
   engine evaluates it, **Then** the band cannot be Established and the capping condition says so,
   exactly as in 0.2.0.
6. **Given** a ledger with a retracted load-bearing origin, **When** the engine evaluates it,
   **Then** the band is Refuted regardless of the new counter-steelman field — retraction is
   unchanged.
7. **Given** a ledger whose claim-supporting lead's adversarial status is failed, **When** the
   engine evaluates it, **Then** the band is Refuted and the recorded condition quotes
   "adversarial Failed on the load-bearing evidence".
8. **Given** a ledger with a strong silence finding and support that would otherwise reach
   Probable, **When** the engine evaluates it, **Then** the band is Doubtful and the recorded
   condition quotes "an unexplained strong silence finding".

---

### User Story 2 - A reader sees why counter-evidence did not refute (Priority: P1)

A reader of a claim report sees a claim with strong contrary evidence that nonetheless reads
Doubtful rather than Refuted. On the page they find the reason stated in plain language: the
contrary evidence has not yet been stress-tested in the claim's favour, and the platform does not
call a claim false on evidence it has not tried to defeat. They can see that this is a limitation
of the run, named as such, not a finding about the claim.

**Why this priority**: Principle III says failures and omissions must be visible. A band held at
Doubtful because a step has not run is exactly the kind of cap that must be named on the trace; a
reader who cannot see it will read Doubtful as a verdict about the evidence rather than about the
process.

**Independent Test**: Regenerate the Great Wall report from its stored run under the new engine.
The page shows the recorded band (Refuted, engine 0.2.0), shows what the current engine computes
(Doubtful), marks the record superseded, and names the missing counter-steelman as the condition
holding the band at Doubtful.

**Acceptance Scenarios**:

1. **Given** a stored run whose contrary evidence clears the physical/re-testable grade but whose
   counter-steelman status is untested, **When** the report is generated, **Then** the current-engine
   band is Doubtful and a capping condition on the page states, in plain language and with the
   protocol term alongside, that the contrary evidence has not been steelmanned.
2. **Given** a stored run whose counter-steelman status is failed, **When** the report is
   generated, **Then** the band is Doubtful and the capping condition says the contrary evidence did
   not survive its steelman.
3. **Given** the Great Wall record as committed today, **When** the report is generated under the
   new engine, **Then** the page shows both the recorded band and the current band, marks the
   record superseded, and does not alter the stored record.
4. **Given** any run, **When** the report is generated, **Then** the counter-steelman status
   appears with its plain-language rendering and the exact protocol term, and appears in the
   glossary.

---

### User Story 3 - A contributor's stored runs survive the schema change (Priority: P2)

A contributor who committed run records under the previous schema regenerates their reports after
this feature lands. Every record still reads; the new field is present with an explicit "untested"
value and the page says the value was supplied by migration, not by a run. No record is refused,
rewritten by hand, or silently reinterpreted.

**Why this priority**: Principle IV forbids a schema change that invalidates stored runs without a
migration. There are only two committed records today; this is the cheapest the migration will
ever be, and it sets the pattern the next schema change (the missing provenance stamps, F-03) will
reuse.

**Independent Test**: Run the migration over the corpus, then generate every claim's report. Both
succeed; both pages show the new field as untested-by-migration; running the migration a second
time changes nothing.

**Acceptance Scenarios**:

1. **Given** a stored run at the previous schema version, **When** the migration runs, **Then** the
   record carries the new schema version and the new field set to untested, and every other field
   is byte-for-byte unchanged.
2. **Given** a stored run already at the new schema version, **When** the migration runs, **Then**
   the record is untouched.
3. **Given** a stored run at the previous schema version that has NOT been migrated, **When** a
   report is generated from it, **Then** the read fails naming the file, the field, and the version
   it expected — it does not silently default the field.
4. **Given** a hand-authored claim file that attempts to set the new field, **When** the corpus is
   read, **Then** the read fails naming the file and the field, as it does for any engine-consumed
   field.

---

### User Story 4 - The pipeline stress-tests contrary evidence (Priority: P3)

A run encounters evidence that contradicts the claim. Before that evidence is allowed to refute,
the pipeline runs a step that constructs the strongest available case *for* the claim against that
contrary evidence — the mirror of the existing steelman, which constructs the strongest case
*against* the claim. The outcome (survived / failed / untested) is recorded on the ledger, every
attempt appears on the trace, and the engine consumes it exactly as it consumes the existing
adversarial status. If the step does not run, the trace says so.

**Why this priority**: This is what makes Refuted-from-evidence reachable again. It is P3 because
User Stories 1–3 deliver a correct, honest engine without it: the engine caps at Doubtful and says
why. Until this story ships, the platform is structurally incapable of refuting a claim on
evidence — which is the conservative failure mode, and the one the owner chose.

**Independent Test**: Replay the Great Wall transcript through the manual-run harness with a human
answering the new step. The run completes, the ledger carries the step's outcome, the trace shows
the step, and the engine reaches Refuted only when the human's answer is "survived".

**Acceptance Scenarios**:

1. **Given** a run whose diagnosticity step marked at least one line inconsistent with the claim,
   **When** the pipeline reaches the counter-steelman step, **Then** the step runs once against the
   strongest opposing line (by bearing, then grade — the same selection the existing adversarial
   step uses) and records survived, failed, or untested.
2. **Given** a run with no line marked inconsistent with the claim, **When** the pipeline reaches
   the counter-steelman step, **Then** the step records untested with a reason ("no contrary
   evidence to test") and makes no model call.
3. **Given** the step's model output fails validation, **When** remediation runs, **Then** each
   attempt appears on the trace with its violation, and exhausting the budget results in untested
   with the unresolved-violation flag — never in survived.
4. **Given** the step is not yet built or is disabled, **When** a run completes, **Then** the trace
   carries a named skip stamp for it and the ledger field is untested.

---

### Edge Cases

- **Opposing cluster at physical grade, but the supporting side also has a physical cluster.** The
  protocol calls the contrary cluster "decisive"; the engine must define decisive. Default: the
  opposing side must also outweigh or match the supporting side on grade (see FR-008); a physical
  cluster on each side with comparable count is Contested-conflicting, not Refuted.
- **Strong silence finding present alongside strong counter-evidence.** 0.2.0 blocked Refuted when
  silence was strong. Silence is evidence *against* the claim, so it should never protect a claim
  from refutation. See FR-009.
- **Counter-steelman survived, but the opposing cluster is below physical grade.** Not Refuted:
  the steelman is necessary, not sufficient. Band follows FR-010/FR-011.
- **Counter-steelman recorded as survived on a ledger with no opposing line.** A contradiction in
  the input; the engine must refuse the ledger naming the field, not guess.
- **Every opposing line is retracted.** Retracted origins already drop out at normalization; the
  opposing side is then empty and the counter-steelman status must be untested (nothing to test).
  The migration default covers stored runs; new runs must not produce it.
- **A stored run under 0.2.0 that reads Refuted-by-evidence.** Exactly the Great Wall case. The
  record is not edited; the report shows drift. This is the designed behaviour of the stability
  record and must not be treated as a regression by any test.
- **Manual-run transcripts.** They are prompt/answer lists, not ledgers, so they carry no ledger
  field to migrate. Replaying an old transcript through a pipeline that now has a new step will
  find no answer for that step; the harness must report the missing answer by step name rather
  than fail obscurely.
- **No support and no opposition, but a strong silence finding.** Nothing survives, so
  Unsupported (FR-011b) — a burden finding — takes precedence over Doubtful — strong silence.
  Silence can lower a supported claim; it cannot manufacture an evidential finding where no
  evidence exists.
- **Support outweighs opposition, but the supporting lead's adversarial status is failed.** Refuted
  (FR-020): the protocol makes adversarial failure on the load-bearing evidence a refutation route
  regardless of how much other support exists. A fixture must cover it.

## Requirements *(mandatory)*

### Functional Requirements

**Versions and migration (Principle IV)**

- **FR-001**: The engine version MUST become 0.3.0, and every verdict MUST stamp it.
- **FR-002**: The ledger schema MUST gain a counter-steelman status field with exactly three
  values — survived, failed, untested — and the schema version MUST be bumped. The existing
  adversarial status MUST gain the value failed in the same bump (FR-020).
- **FR-003**: A migration MUST exist that brings every stored run record at the previous schema
  version to the new one by setting the new field to untested and changing nothing else. It MUST be
  idempotent and MUST report each file it changed and each it skipped.
- **FR-004**: Reading a stored run at a schema version the reader does not support MUST fail
  naming the file, the field, and the expected version. The field MUST NOT be defaulted at read
  time.
- **FR-005**: The migration MUST be designed so that a later field addition (the provenance stamps
  in F-03) can reuse its mechanism without a second copy of the version-walking logic.

**Tree 1 refutation (ruling a; Principle I)**

- **FR-006**: The engine MUST reach Refuted from counter-evidence when, and only when, all of the
  following hold: at least one opposing cluster's grade is physical/re-testable; the opposing side
  is decisive (FR-008); and the counter-steelman status is survived. The recorded condition MUST
  quote "decisive contrary physical/re-testable cluster".
- **FR-007**: The engine MUST NOT reach Refuted from counter-evidence on any weaker grade,
  regardless of opposing cluster count. The 0.2.0 rule (two or more clusters at
  contemporaneous-record or better) is withdrawn.
- **FR-008**: "Decisive" MUST mean: the opposing side's best grade is at least the supporting
  side's best grade, and the opposing side is not outweighed on cluster count. Two physical
  clusters, one per side, with equal count is not decisive.
- **FR-009**: A strong silence finding MUST NOT block Refuted. Silence is evidence against the
  claim; the 0.2.0 condition that required "no strong silence" for refutation is withdrawn.
- **FR-010**: Refuted by retraction of a load-bearing origin MUST remain reachable exactly as in
  0.2.0, independent of the counter-steelman status.

**Doubtful (ruling b; Principle I)**

- **FR-011**: The engine MUST reach Doubtful when opposing diagnostic evidence outweighs supporting
  evidence on grade or on cluster count and Refuted is not reached. The recorded condition MUST
  quote "contrary diagnostic evidence outweighs support on grade or count". This replaces 0.2.0's
  routing of that case to Contested-insufficient.
- **FR-011a**: Every Doubtful band MUST carry a mandatory qualifier, exactly as Contested does,
  recording the burden state alongside the evidential finding. The qualifiers are:
  **no surviving support** (nothing supports the claim; surviving evidence points against it),
  **outweighed** (some support survives but contrary evidence outweighs it on grade or count),
  and **strong silence** (support is not outweighed, but an unexplained strong silence finding
  holds the band down — FR-015). A Doubtful band without a qualifier MUST be refused by the
  verdict validator naming the field.
- **FR-011b**: Unsupported MUST be returned only when nothing survives on either side. A ledger
  with no surviving supporting line and at least one surviving opposing line MUST NOT return
  Unsupported; it returns Doubtful — no surviving support (or Refuted if FR-006 or FR-020 holds).
  This changes 0.2.0, which returned Unsupported for that case.
- **FR-011c**: The two facts a Doubtful — no surviving support band carries MUST both be visible on
  the report: that the claimant's burden is unmet, and that surviving evidence points against the
  claim. Neither fact may be dropped in favour of the other.

- **FR-012**: When the opposing side would satisfy FR-006 except that the counter-steelman status
  is untested, the engine MUST return Doubtful with a capping condition naming the counter-steelman
  as not performed.
- **FR-013**: When the opposing side would satisfy FR-006 except that the counter-steelman status
  is failed, the engine MUST return Doubtful with a capping condition naming the counter-steelman
  as failed. Failed MUST NOT produce a band above Doubtful.
- **FR-014**: Contested-conflicting (comparable grade and count on both sides) MUST remain exactly
  as in 0.2.0. Opposition weaker than support MUST continue to block Established and MUST NOT
  block Probable. The existing fixtures for those two behaviours MUST pass unchanged.
- **FR-015**: A strong silence finding MUST cap the band at Doubtful: when the silence finding is
  strong and Refuted is not reached (FR-006, FR-010), the engine MUST return Doubtful with the
  qualifier strong silence (or no surviving support / outweighed where one of those also holds —
  the burden qualifier takes precedence) and a condition quoting "an unexplained strong silence
  finding". This implements the second half of
  the protocol's Doubtful clause, which 0.2.0 did not reach (strong silence only blocked
  Established). A strong silence finding MUST NOT prevent Refuted (FR-009). The ledger's silence
  finding is not yet produced by any pipeline step (tracked as F-11b); until it is, this path is
  exercised by fixtures and hand-built ledgers only.

**Counter-steelman semantics (ruling c; Principle II)**

- **FR-016**: The counter-steelman is defined as: the strongest available case FOR the claim
  against the contrary evidence — the mirror of the protocol's Steelman step. Its outcomes are
  survived (the contrary evidence withstood the case for the claim), failed (it did not), untested
  (no test was possible or none ran).
- **FR-017**: A ledger carrying counter-steelman status survived or failed while holding no line
  marked inconsistent with the claim MUST be refused by the engine, naming the field.
- **FR-018**: The counter-steelman status MUST have no effect on any band other than Refuted and
  Doubtful. In particular it MUST NOT raise a band and MUST NOT affect the Established or Probable
  conditions, which continue to depend on the existing adversarial status of the claim-supporting
  lead.
- **FR-019**: The protocol document MUST be amended to add the counter-steelman as a named step
  with the definition and outcomes in FR-016, and to state under Tree 1's Refuted clause that
  "decisive contrary physical/re-testable cluster" requires that step to have been survived. The
  amendment MUST cite this feature and the review that produced it, and MUST also add the
  mandatory Doubtful qualifier (FR-011a) to the Bands section, beside Contested's.
- **FR-020**: The existing adversarial status (the claim-supporting lead's) MUST gain the value
  failed, matching the protocol's Step 7 outputs Survived / Failed / Untested. The engine MUST
  reach Refuted when the adversarial status is failed, with a condition quoting "adversarial
  Failed on the load-bearing evidence". This makes the protocol's third route to Refuted
  reachable; it has been unreachable since the schema was first written. Existing stored values
  (survived, untested) remain valid and need no migration. The existing adversarial pipeline step
  MUST be able to report failed, but only under the evidentiary constraint in FR-020a — never as a
  fallback for an inconclusive or exhausted attempt, which stays untested.
- **FR-020a**: The adversarial status MAY be set to failed ONLY on a cited, retrievable record of
  a real-world serious attempt in which the lead evidence did not hold up — a failed replication,
  an adverse regulatory or court finding, a retraction notice, a published adversarial review, or
  equivalent. "Serious attempt" is the protocol's own definition: "competence to test, access to
  the relevant evidence, and a motive or mandate to find the claim false if it is false". The
  record MUST be an origin in the ledger, retrieved and archived like any other evidence, and the
  verdict MUST name it.
- **FR-020b**: A model's own reasoning MUST NOT set failed, however decisive the weakness it
  finds. Where the adversarial step identifies a weakness with no cited real-world attempt behind
  it, the status stays untested, the weakness is recorded on the trace as a finding, and the
  existing revision flag reports that something surfaced the automatic grade does not reflect.
  Rationale: Principle II states that model training memory "MAY generate hypotheses and rival
  explanations; it MUST NOT serve as evidence." Refuted is the most consequential verdict the
  platform can publish, and a route to it whose sole support is an argument the system generated
  itself would make the system its own evidence. The same constraint applies to the
  counter-steelman's failed value (FR-016).


**Trace and condition text (Principle III)**

- **FR-021**: Every Tree 1 band the engine returns MUST record, in its conditions met and capping
  conditions, the protocol clause implemented, so that a reviewer can locate each condition in
  the protocol text without reading the engine.
- **FR-022**: Capping-condition text for an unperformed counter-steelman MUST make clear that the
  cap is a limitation of the run, not a finding about the claim.

**Fixtures (Development Workflow)**

- **FR-023**: The fixture suite MUST include, each traceable to a protocol clause:
  `tree1-refuted-by-counter-evidence` reworked to require a physical/re-testable opposing cluster
  and survived counter-steelman; `tree1-unsupported-counter-below-bar` renamed and reworked to
  `tree1-doubtful-no-surviving-support` (FR-011b);
  new `tree1-doubtful-counter-outweighs`; new `tree1-doubtful-physical-counter-untested`; new
  `tree1-doubtful-physical-counter-failed`; and a fixture proving the 0.2.0 bar (two
  contemporaneous-record opposing clusters) no longer refutes. Additionally: new
  `tree1-refuted-adversarial-failed` (FR-020), whose ledger must carry the cited attempt as an
  origin (FR-020a); new `tree1-doubtful-strong-silence` (FR-015); and new
  `aggregate-doubtful-below-contested` (FR-038).
- **FR-024**: `tree1-contested-conflicting-evidence` and `tree1-counter-evidence-blocks-established`
  MUST pass without modification. If either fails during implementation, the implementer MUST stop
  and raise it rather than adjust the fixture.
- **FR-025**: The suite MUST continue to run with zero network access and zero model calls.

**Report (Principle III)**

- **FR-026**: The claim report MUST show the counter-steelman status with a plain-language rendering
  and the exact protocol term alongside, and the glossary MUST define the term.
- **FR-027**: When the field's value was supplied by migration rather than by a run, the report
  MUST say so.
- **FR-028**: The stability record MUST show the Great Wall record's drift from the recorded band
  to the current-engine band as superseded, with both bands and both engine versions visible, and
  MUST NOT modify the stored record.

**Pipeline step (User Story 4; Principles II, III, V)**

- **FR-029**: The pipeline MUST include a counter-steelman step that runs after diagnosticity and
  the existing adversarial step, selects the strongest opposing line by bearing then grade, and
  writes only the counter-steelman status and its trace entries.
- **FR-030**: The step MUST receive exactly what the existing adversarial step receives, mirrored:
  the claim text and the archived content of the single strongest opposing origin, delimited as
  untrusted data. It MUST NOT receive the ledger, any warrant grade, any other origin, the
  supporting side's adversarial outcome, or any rival. Knowing the claim is inherent to building a
  case for it, as it is for the existing step's case against it; blindness to the ledger is what
  keeps the two steps symmetric.
- **FR-031**: The step MUST make no model call when no line is inconsistent with the claim, and
  MUST record untested with a stated reason.
- **FR-032**: The step MUST run through the bounded remediation loop; every attempt MUST appear on
  the trace; an exhausted budget MUST yield untested, never survived.
- **FR-033**: Until the step exists, the pipeline MUST stamp a named skip entry on the trace for
  every completed run, and the manual-run harness MUST name the step when a transcript lacks an
  answer for it.
- **FR-034**: Source content reaching the step MUST be delimited as untrusted data, exactly as for
  every other step.

**Non-diagnostic asymmetry (ruling d)**

- **FR-035**: The non-diagnostic exclusion MUST continue to apply only to lines consistent with the
  claim. No symmetric exclusion of opposing lines is introduced. This is a deliberate decision, not
  an omission: a supporting line must discriminate the claim from its rivals to corroborate it; a
  line that contradicts the claim does so whichever rival is true. Any future proposal to change
  this is a new methodology review.

**Invariants (carried from every prior feature)**

- **FR-036**: No band MUST be authorable, computed anywhere outside the engine, or displayed as a
  number.
- **FR-037**: Every validation failure MUST name the file and the specific field.

**Band ordering (Principle I)**

- **FR-038**: The engine's band ordering used for minimum-of-sub-claims aggregation and dual-tree
  routing MUST match the protocol's sequence: Refuted, Unsupported, Doubtful, Contested, Probable,
  Established (weakest first; the non-band verdicts Unfalsifiable and Unresolvable remain below
  all of them). The current ordering places Doubtful above Contested, so a compound claim with one
  Doubtful and one Contested sub-claim aggregates to Contested; after this change it aggregates to
  Doubtful. A fixture MUST lock this in.

### Key Entities

- **Counter-steelman status**: a per-run outcome of stress-testing the contrary evidence in the
  claim's favour. Values: survived, failed, untested. Consumed only by Tree 1's Refuted and
  Doubtful paths. Distinct from the existing adversarial status, which describes the
  claim-supporting lead.
- **Adversarial status** (existing): the outcome of the steelman against the claim-supporting
  lead. Gains the value failed, which reaches Refuted; survived and untested are unchanged.
- **Doubtful qualifier**: mandatory on every Doubtful band. One of no surviving support,
  outweighed, strong silence. Records the burden axis so the band can stay on the evidential
  axis.
- **Opposing side / supporting side**: the two partitions of surviving diagnostic lines by their
  mark against the claim, each with a cluster count and a best grade. Introduced in 0.2.0;
  unchanged here except for how the opposing side's strength is judged.
- **Decisiveness**: the relation between the two sides that, combined with a physical/re-testable
  opposing grade and a survived counter-steelman, reaches Refuted (FR-008).
- **Stored run record**: the machine-readable record of one run; gains one field and a new schema
  version; migrated in place.
- **Protocol amendment**: a dated change to the protocol document adding the counter-steelman step
  and citing this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For every Tree 1 band clause in the protocol text quoted above, a reviewer can name
  the fixture that exercises it and the recorded condition that quotes it; for every recorded
  condition, they can find its clause. Zero unmatched in either direction.
- **SC-002**: The fixture suite passes with the network disabled and no credentials configured,
  including the nine fixtures named in FR-023, and the two fixtures named in FR-024 are unchanged
  from their committed form.
- **SC-003**: The 0.2.0 refutation input (two opposing clusters at contemporaneous-record, no
  physical cluster) produces Doubtful, never Refuted, under 0.3.0.
- **SC-004**: Both committed corpus records migrate, regenerate, and display without error; a
  second migration pass changes zero files.
- **SC-005**: The Great Wall report shows recorded band Refuted (0.2.0) and current band Doubtful
  (0.3.0), marked superseded, with the counter-steelman named as the capping condition — and a
  reader unfamiliar with the project can say, from the page alone, why the claim is not marked
  false.
- **SC-006**: A stored run that skips migration is refused with a message naming the file, the
  field, and the version expected — verified by a test.
- **SC-006a**: No input consisting only of model-generated reasoning can produce Refuted. Verified
  by a test: an adversarial step output reporting a decisive weakness with no cited attempt origin
  yields untested, and the band does not reach Refuted.
- **SC-007**: The protocol document contains the counter-steelman step and the amended Refuted
  clause, dated and citing this feature.
- **SC-008**: Where the pipeline step is built: replaying the Great Wall transcript with the step's
  answer set to survived reaches Refuted; set to failed or untested reaches Doubtful; and every
  attempt of the step is visible on the trace.

## Assumptions

- **Refuted is never reachable on model reasoning alone.** Every route to Refuted rests on a
  retrievable artefact: a retraction notice, a decisive physical/re-testable opposing cluster, or
  a cited record of a failed serious attempt. This is what keeps the platform's most consequential
  verdict defensible by its own protocol.
- **The protocol text is the specification.** Where 0.2.0 and the protocol disagree, the protocol
  wins and the engine changes; where the protocol lacks a rule the owner requires (the
  counter-steelman), the protocol is amended first and the engine follows. The engine never
  carries a rule with no protocol source.
- **"Physical/re-testable" is the existing top warrant grade.** The engine's grade scale already has
  a physical/documentary grade as its highest; the protocol's "physical/re-testable cluster" maps to
  a cluster whose best grade is that one. No new grade is introduced.
- **Migration default is untested.** A stored run made before the counter-steelman existed cannot
  honestly claim the contrary evidence survived or failed a test that never ran. Untested is the
  only defensible value and it produces the conservative band.
- **Manual-run transcripts are not migrated.** They hold prompt/answer pairs, not ledger fields;
  replaying one through a pipeline with a new step will simply lack an answer for that step, which
  the harness must name. The two committed records, not the transcripts, are what the migration
  touches.
- **The pipeline step (User Story 4) is in scope but lowest priority.** Stories 1–3 deliver a
  complete, honest engine that cannot refute on evidence and says so. Story 4 makes refutation
  reachable. If the feature must be cut, it is cut at Story 4 and FR-033's skip stamp is the
  shipped behaviour.
- **Counter-steelman applies to Tree 1 only.** Trees 2–4 do not consult evidence (F-01); the field
  is carried on every ledger for schema uniformity but is consumed only by Tree 1 until F-01
  defines its role elsewhere.
- **Selection of the line to steelman mirrors the existing adversarial step**: strongest opposing
  line by bearing on the claim, then by grade. One line per run; the budget is one step, not one
  per opposing origin.
- **The report's stability record already exists** (005, FR-029a) and needs only the new field
  rendered; no change to how drift is detected.
- **Out of scope**: Trees 2–4 depth (F-01); aggregator trace-through (F-02); protocol_version and
  registry_version stamps (F-03), though FR-005 requires the migration to be reusable for them;
  any change to how the supporting side's adversarial status is produced; any symmetric
  non-diagnostic rule (FR-035).
