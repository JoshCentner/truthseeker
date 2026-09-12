# Feature Specification: Deterministic Rule Engine, Core Schema, and Fixture Suite

**Feature Branch**: `001-rule-engine-core`

**Created**: 2026-09-10

**Status**: Draft

**Input**: User description: "Rule engine + schema + fixtures — the typed core schema, the four decision trees, aggregation, demotion tables, and the hand-worked fixture suite (Phase 0, GROUNDTRUTH-PLATFORM-BRIEF-v0.2.md §18)"

## Clarifications

### Session 2026-09-12

- Q: Does the EXTRAORDINARY flag's Contested ceiling apply to Probable as well as Established, and must the qualifying cluster itself have survived adversarial testing? → A: Gates both Probable and Established; the qualifying cluster must have individually survived adversarial testing
- Q: What should "comparable grade and cluster count" mean for a Contested – conflicting-evidence verdict? → A: Exact match required on both grade and cluster count; any mismatch means "not comparable" and the tree proceeds on whichever side is higher
- Q: How many independently-failing supplementary sub-claims should trigger the one-step demotion of a compound claim's aggregated band? → A: 2 — matches the protocol's existing two-cluster corroboration-minimum threshold used everywhere else

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Normalize a populated ledger before any band is considered (Priority: P1)

An evaluation has produced a ledger of judgments: origins with warrant grades, fired triggers,
interested-party flags, source-reliability grades, contamination channels between lines, and
diagnosticity marks. Before any band can be reasoned about, the ledger must be reduced to the
state the trees actually read: which lines survive, what each surviving line is worth, how many
independent clusters exist, and which lines are excluded from counting altogether.

**Why this priority**: Every tree reads this normalized state. The zero-weight rule, the
interested-party demotion table, the reliability interaction table, non-diagnostic exclusion, and
cluster counting are all mechanical, all currently prose, and all wrong-in-the-same-direction if
misencoded. Nothing downstream can be trusted until this is exact.

**Independent Test**: Feed a ledger with known warrant grades, interest flags, reliability grades,
shared channels, and diagnosticity marks; assert the surviving-line set, each line's final weight,
the cluster partition, the cluster count, and the excluded-line list — without computing any band.

**Acceptance Scenarios**:

1. **Given** a ledger containing 40 bare-assertion lines and nothing else, **When** normalization
   runs, **Then** the total surviving evidential weight is zero and the cluster count is zero.
2. **Given** ten lines that resolve to three dependency partitions through shared channels,
   **When** normalization runs, **Then** the independence count is 3 and the dependence map names
   which lines cluster on which shared channels.
3. **Given** a cluster whose members are graded testimony, testimony, and contemporaneous record,
   **When** normalization runs, **Then** the cluster grade is contemporaneous record and internal
   cluster size contributes nothing further.
4. **Given** a testimony line from a source graded Fabricator, **When** normalization runs,
   **Then** that line carries zero weight.
5. **Given** a contemporaneous record created by an interested party after the stakes were
   visible and under that party's control, **When** normalization runs, **Then** the line is
   demoted to testimony.
6. **Given** a line marked consistent with the claim and also consistent with a live rival,
   **When** normalization runs, **Then** the line is reported as non-diagnostic and excluded from
   cluster thresholds and warrant requirements entirely.
7. **Given** an origin marked retracted, **When** normalization runs, **Then** the origin scores
   zero and its entire downstream line is removed from the ledger.

---

### User Story 2 - Compute a simple-factual band with its capping conditions (Priority: P1)

Given a normalized ledger for a simple factual claim, the system returns a band, the tree it used,
every condition that was met, and the specific conditions that prevented a higher band — with no
model call anywhere in the path.

**Why this priority**: This is Constitution Principle I made real, and Tree 1 is the tree every
other tree ultimately rests on. It is also the smallest slice that delivers the project's core
promise: a verdict a model is structurally incapable of inflating.

**Independent Test**: Supply normalized ledger states at each Tree 1 boundary and assert the
returned band, qualifier, tree id, met-conditions list, and capping-conditions list.

**Acceptance Scenarios**:

1. **Given** two independent clusters with best grade at contemporaneous record, no unrebutted
   rival, no strong silence finding, and adversarial status Survived, **When** the band is
   computed, **Then** the band is Established.
2. **Given** the same ledger with adversarial status Untested, **When** the band is computed,
   **Then** the band is Probable and the capping conditions name the adversarial requirement as
   the binding constraint.
3. **Given** a single post-dispute testimony cluster as sole support, **When** the band is
   computed, **Then** the band is Contested with qualifier "insufficient evidence".
4. **Given** a ledger where every surviving line is non-diagnostic, **When** the band is computed,
   **Then** the band is Contested with qualifier "insufficient evidence".
5. **Given** a ledger where nothing survives at any weight, **When** the band is computed,
   **Then** the band is Unsupported and not Refuted.
6. **Given** a load-bearing origin marked retracted, **When** the band is computed, **Then** the
   band is Refuted.
7. **Given** any computed verdict, **When** the output is inspected, **Then** it contains no
   numeric score, probability, or percentage equivalent anywhere.

---

### User Story 3 - Prove the engine reproduces the methodology (Priority: P1)

A methodology reviewer, or the project owner before shipping an engine change, runs a suite of
hand-worked cases taken from the protocol specification and confirms that the engine returns
exactly the band the protocol requires for each one.

**Why this priority**: If the engine misencodes a tree, every verdict is wrong in the same
direction and invisibly so. This suite is the only thing standing between that failure and the
public corpus, and it costs nothing to run.

**Independent Test**: Execute the suite against the engine with no network access and no
credentials configured; every case reports pass or fail with the expected and actual band, the
tree used, and the differing condition when they diverge.

**Acceptance Scenarios**:

1. **Given** the fixture suite and an engine build, **When** the suite runs with no network access
   and no API credentials present, **Then** it completes and reports a pass/fail result for every
   case.
2. **Given** a fixture case whose expected band differs from the engine's output, **When** the
   suite runs, **Then** the failure names the case, the expected band, the actual band, and the
   condition that diverged.
3. **Given** an engine change that alters any band boundary, **When** the suite runs, **Then** at
   least one case fails, so no boundary can move silently.
4. **Given** the completed suite, **When** coverage is inspected, **Then** every band outcome in
   every tree is exercised by at least one case.

---

### User Story 4 - Route causal, predictive, and complex-system claims (Priority: P2)

Claims that are not simple factual are routed to their own tree, and each tree's distinct
structure — prerequisites, necessary conditions, existence conditions, and hard ceilings — is
enforced by the engine rather than trusted to a model.

**Why this priority**: Tree 3's ceiling at Probable and Tree 2's temporality disqualifier are the
two places where an unconstrained model is most likely to overclaim, and both are trivially
decidable in code. Tree 1 alone is a viable slice, so this follows rather than blocks it.

**Independent Test**: Supply normalized ledgers classified causal, predictive, and complex-system,
and assert the band, the ceiling enforcement, and the routing decision for each.

**Acceptance Scenarios**:

1. **Given** a causal claim whose underlying factual claims did not reach Probable, **When** the
   band is computed, **Then** the causal claim inherits the lower band and evaluation stops.
2. **Given** a causal claim with no temporality finding, **When** the band is computed, **Then**
   no band above Doubtful is reachable.
3. **Given** a causal claim satisfying only supportive criteria at any quantity, with no
   discriminating criterion, **When** the band is computed, **Then** the band is Contested with
   qualifier "insufficient evidence".
4. **Given** a predictive claim meeting every Established-shaped condition, **When** the band is
   computed, **Then** the band returned is Probable and the capping conditions state that
   Established is unavailable on this tree.
5. **Given** a complex-system claim that decomposes into sub-claims jointly carrying its meaning,
   **When** the band is computed, **Then** the sub-claims are routed to their own trees and any
   residue not captured is reported.
6. **Given** a complex-system claim that is irreducible, **When** the band is computed, **Then**
   the result is Unresolvable, accompanied by why no band is honest and what evidence would change
   that.
7. **Given** a claim whose classification confidence is Low with two genuinely plausible types,
   **When** the band is computed, **Then** both trees run and the lower band is reported with both
   results shown.

---

### User Story 5 - Aggregate a compound claim from its sub-claims (Priority: P3)

A compound claim's band is derived from the bands of its sub-claims according to fixed rules,
recomputed whenever any sub-claim band changes, with no re-evaluation of evidence.

**Why this priority**: Aggregation is what makes a claim corpus compound rather than flat, and
free recomputation up the graph is what makes a retraction on a leaf propagate instantly. It
depends on the single-claim trees existing first.

**Independent Test**: Supply a compound claim with sub-claim bands and edge types, assert the
aggregated band, then change one sub-claim band and assert the recomputed result with no
evaluation performed.

**Acceptance Scenarios**:

1. **Given** a compound claim with load-bearing sub-claims banded Established, Probable, and
   Contested, **When** aggregation runs, **Then** the compound band is Contested.
2. **Given** a supplementary sub-claim banded Established under a compound banded Probable,
   **When** aggregation runs, **Then** the compound band remains Probable.
3. **Given** any load-bearing sub-claim banded Unresolvable, **When** aggregation runs, **Then**
   the compound is Unresolvable.
4. **Given** an aggregated compound, **When** one sub-claim band changes, **Then** the compound
   band recomputes from the changed sub-claim band alone, and the result names which sub-claim
   moved it.
5. **Given** a single claim supported by several independent evidence clusters, **When**
   aggregation runs, **Then** the aggregation rules do not reduce its reachable band, because
   converging clusters are counted during normalization and are not sub-claims.

---

### Edge Cases

- **Nothing survives.** A ledger where every line is zero-weighted returns Unsupported, never
  Contested and never Refuted — a burden finding, not a falsity finding.
- **Everything is non-diagnostic.** Surviving lines exist but none separate the claim from a live
  rival: Contested — insufficient evidence, with the non-diagnostic lines reported, not hidden.
- **The falsifiability screen fires.** The claim exits as Unfalsifiable before any tree runs; this
  is a structural verdict and must not be presented as a truth judgment.
- **Internally contradictory ledger.** Cluster count disagrees with the partition, a fired trigger
  has no named mechanism, or a band-relevant field is absent: the engine refuses to emit a band
  and reports which input is inconsistent, rather than guessing a default.
- **Adversarial status Untested.** A valid and informative state, not missing data — it caps the
  band at Probable and must appear in the capping conditions.
- **Extraordinary claim.** The prior-plausibility screen fired, changing what the claim must hold
  to reach its ceiling.
- **A rival is unrebutted.** Distinguish an unrebutted rival that is more plausible than the claim
  from one that is not; the two cap at different bands.
- **Post-dispute testimony at volume.** Any number of post-dispute testimony clusters cannot carry
  above Contested, though they still corroborate.
- **Upgrade triggers at the ceiling.** Replication and pre-registration cannot lift evidence above
  physical/documentary grade, however many fire.
- **Compound with a cycle.** Sub-claim relationships presented to aggregation contain a cycle:
  aggregation refuses rather than recursing.
- **Steelman changed the assessment.** A judgment was revised after the steelman was written; the
  engine bands the revised ledger and the trace records that a revision occurred.

## Requirements *(mandatory)*

### Functional Requirements

#### The schema

- **FR-001**: System MUST define a typed core schema covering every field the protocol's twelve
  mandatory output items require, and per-tree extension blocks for causal, predictive, and
  complex-system claims.
- **FR-002**: The schema MUST carry its own version identifier, distinct from the protocol version
  and the engine version.
- **FR-003**: The schema MUST distinguish judgment fields (supplied by evaluators) from computed
  fields (written only by the engine), and the engine MUST refuse to accept a ledger in which a
  computed field is pre-populated with a conflicting value.
- **FR-004**: Every field the engine reads MUST be explicitly typed with its permitted values, so
  that an out-of-range value is detectable rather than silently coerced.

#### Determinism and purity

- **FR-005**: The engine MUST compute a verdict using only the supplied ledger, performing no
  network access, no model call, and no retrieval of any kind.
- **FR-006**: The engine MUST be deterministic: identical ledger input MUST produce byte-identical
  verdict output on every execution.
- **FR-007**: The engine MUST NOT accept, request, or act on any free-text instruction from the
  ledger; ledger text fields are data carried through to output, never control flow.
- **FR-008**: The engine MUST refuse to emit a band when a band-relevant input is missing,
  out-of-range, or internally contradictory, and MUST report which input failed.

#### Ledger normalization

- **FR-009**: System MUST apply the zero-weight rule: bare assertion carries zero weight at any
  volume, and testimony MUST NOT be zeroed by this rule.
- **FR-010**: System MUST remove the entire downstream line of a retracted origin, and MUST
  evaluate only the corrected form of a corrected origin.
- **FR-011**: System MUST grade an origin that could not be retrieved and inspected as bare
  assertion, regardless of what it is claimed to be.
- **FR-012**: System MUST apply one grade step of downgrade per fired trigger, with no limit, and
  MUST reject any fired trigger that lacks a recorded named mechanism.
- **FR-013**: System MUST apply upgrade triggers without permitting any upgrade to raise evidence
  above physical/documentary grade.
- **FR-014**: System MUST apply the interested-party table by warrant grade: no discount for
  re-testable and physical evidence; contemporaneous record demoted to testimony only where the
  party controlled its creation after stakes were visible; testimony treated as assertion for
  carrying a claim while retaining corroboration value; assertion zero.
- **FR-015**: System MUST apply the source-reliability interaction downward only, and MUST NOT
  allow any reliability grade to upgrade evidence or convert assertion into evidence.
- **FR-016**: System MUST partition surviving lines into dependency clusters, where lines sharing
  any of the four contamination channels — underlying data, method, institution, motive — directly
  or transitively, form one cluster.
- **FR-017**: System MUST set the independence count to the number of clusters, MUST set each
  cluster's grade to its best member's grade, and MUST NOT let internal cluster size add weight.
- **FR-018**: System MUST exclude non-diagnostic lines from cluster thresholds and warrant
  requirements entirely, while still reporting them.
- **FR-019**: System MUST mark a rival as unrebutted when no surviving line is marked inconsistent
  with it.
- **FR-020**: System MUST output the dependence map naming which lines cluster on which shared
  channels.

#### Band computation

- **FR-021**: System MUST compute the band by evaluating fixed conditions over the normalized
  ledger. No model may select, name, or influence the band.
- **FR-022**: System MUST attach the mandatory qualifier to every Contested band, distinguishing
  conflicting evidence from insufficient evidence.
- **FR-023**: System MUST NOT produce Contested from public controversy, political salience, or
  opinion volume; only diagnostic evidence may produce it.
- **FR-024**: System MUST enforce the corroboration minimum of two clusters as the
  uncorroborated/corroborated boundary, and MUST NOT apply any threshold above two.
- **FR-025**: System MUST enforce Tree 2's prerequisite: where the underlying factual claims did
  not reach Probable, the causal claim inherits the lower band and evaluation stops.
- **FR-026**: System MUST treat temporality as a necessary condition on Tree 2, disqualifying
  every band above Doubtful when it fails.
- **FR-027**: System MUST treat the discriminating criteria on Tree 2 as an existence condition
  that supportive criteria cannot satisfy at any quantity.
- **FR-028**: System MUST cap Tree 3 at Probable and MUST make Established unreachable on that
  tree under all inputs.
- **FR-029**: System MUST route a decomposable complex-system claim to its sub-claims' trees and
  report any residue not captured; an irreducible one MUST return Unresolvable with why no band is
  honest and what evidence would change that.
- **FR-030**: System MUST run both trees and report the lower band, showing both results, when the
  classification identifies two genuinely plausible types.
- **FR-031**: System MUST apply the extraordinary-claim condition when the prior-plausibility
  screen has fired, capping the band at Contested for both Probable and Established unless the
  ledger contains at least one re-testable or physical-record cluster that has itself survived
  adversarial testing, independently of the tree's overall adversarial-status condition.
- **FR-032**: System MUST distinguish Unsupported (nothing survives; a burden finding) from
  Refuted (affirmatively shown false or load-bearing evidence collapsed; a falsity finding), and
  MUST NOT substitute one for the other.
- **FR-033**: System MUST return Unfalsifiable as a structural non-band verdict without running
  any tree when the falsifiability screen fires.
- **FR-034**: System MUST determine Contested — conflicting evidence only when diagnostic
  evidence on both sides matches exactly on both grade and cluster count; whenever the two axes
  do not match exactly, the ledger MUST proceed under the tree's ordinary conditions for whichever
  side holds the higher grade or cluster count, rather than being treated as conflicting.

#### Aggregation

- **FR-035**: System MUST set a compound claim's band to the minimum across its load-bearing
  sub-claims.
- **FR-036**: System MUST prevent supplementary sub-claims from raising a compound band.
- **FR-037**: System MUST allow supplementary sub-claims to lower a compound band by exactly one
  step when two or more independently fail, matching the protocol's existing two-cluster
  corroboration-minimum threshold used elsewhere.
- **FR-038**: System MUST return Unresolvable for any compound with a load-bearing sub-claim
  banded Unresolvable.
- **FR-039**: System MUST recompute an aggregated band from changed sub-claim bands alone,
  performing no re-evaluation, and MUST name which sub-claim moved the result.
- **FR-040**: System MUST refuse to aggregate a sub-claim structure containing a cycle.
- **FR-041**: System MUST NOT let aggregation rules constrain the band reachable by a single claim
  supported by multiple converging independent clusters.

#### Verdict output and trace

- **FR-042**: System MUST emit, with every verdict: the band, its qualifier where applicable, the
  tree used, every condition met, and the specific conditions that capped it.
- **FR-043**: System MUST emit at least one capping condition whenever the band is below the
  highest band reachable on the tree used.
- **FR-044**: System MUST NOT emit any numeric score, probability, or percentage equivalent
  anywhere in the verdict.
- **FR-045**: System MUST stamp the engine version and the schema version on every verdict.
- **FR-046**: Every emitted condition MUST carry a stable identifier that maps to the protocol
  clause it encodes, so a reviewer can trace any band to the methodology text.

#### Fixture suite

- **FR-047**: System MUST provide a fixture suite of hand-worked cases derived from the protocol,
  each pairing a ledger with the band the protocol requires.
- **FR-048**: The suite MUST execute with no network access and no credentials present, and MUST
  incur zero monetary cost.
- **FR-049**: The suite MUST cover every band outcome of every tree, plus the normalization rules,
  the aggregation rules, and each refusal case.
- **FR-050**: A failing case MUST report the case identifier, the expected band, the actual band,
  and the condition that diverged.
- **FR-051**: The suite MUST fail whenever any band boundary moves, so no boundary can change
  silently.

### Key Entities

- **Ledger**: One claim's complete evaluation state — the schema instance. Holds the claim's
  restatement, classification, screen results, origins, warrants, clusters, completeness findings,
  rivals, diagnosticity marks, adversarial status, and steelman. Input to the engine.
- **Origin**: Where a piece of evidence first entered the record. Carries retrieval status,
  retraction status, and any mutation note. Everything sharing an origin collapses into one
  evidence line.
- **Warrant**: One origin's grading — starting grade, signalling answers, fired triggers each with
  a named mechanism, upgrades, interested-party flag, final grade, and source-reliability grade.
- **Evidence Line**: A surviving origin plus its grading, after normalization. Carries a final
  weight and a diagnosticity mark.
- **Cluster**: A partition of evidence lines connected by shared contamination channels. Carries
  its member lines, its shared channels, and its grade (its best member's).
- **Rival**: A competing explanation, with its rebuttal status and its plausibility relative to
  the claim.
- **Diagnosticity Matrix**: Consistent / inconsistent / not-applicable marks for every surviving
  line against the claim and every live rival. Determines which lines are non-diagnostic.
- **Verdict**: The engine's output — band, qualifier, tree used, conditions met, capping
  conditions, and version stamps. Never contains a score.
- **Fixture Case**: A hand-worked ledger paired with the band the protocol requires, plus the
  protocol clause it exercises.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The engine produces a verdict for a fully populated ledger with zero network calls,
  zero model calls, and zero monetary cost, verified by running the full suite with no credentials
  configured and no network available.
- **SC-002**: 100% of hand-worked fixture cases return exactly the band the protocol requires.
- **SC-003**: Every band outcome of every tree is exercised by at least one fixture case — 100%
  outcome coverage, measured and reported by the suite.
- **SC-004**: Running the same ledger 100 times produces 100 identical verdicts.
- **SC-005**: 100% of verdicts below the tree's highest reachable band name at least one specific
  capping condition.
- **SC-006**: 0 verdicts contain a numeric score, probability, or percentage equivalent.
- **SC-007**: 100% of conditions emitted in a verdict map to an identifiable protocol clause, so a
  reviewer can trace any band back to the methodology text without reading the implementation.
- **SC-008**: The full suite completes fast enough to run on every change without friction —
  under 60 seconds on a developer machine.
- **SC-009**: An inconsistent or incomplete ledger produces a refusal naming the offending input
  in 100% of cases, and never a guessed band.
- **SC-010**: A reviewer with the protocol in hand but no knowledge of the implementation can
  confirm or reject any single fixture case's expected band in under 10 minutes.

## Assumptions

- **Judgments arrive already made.** The evaluation skills that populate the ledger are out of
  scope. This feature consumes a populated ledger and produces a verdict; how the ledger got
  populated is a separate feature.
- **Deterministic protocol-compliance checks are a separate feature.** The validation layer from
  the brief's §5 (origin has a retrievable URL, no aggregator origins, and so on) is deliberately
  excluded here. The narrow refusal behavior in FR-008 covers only inputs the engine cannot band
  without, not full compliance validation.
- **Persistence is out of scope.** The database, migrations, and stored-run format are a separate
  feature. This engine reads a ledger and returns a verdict in memory.
- **The claim graph is out of scope.** Aggregation here operates on a sub-claim structure handed
  to it. Graph storage, typed edges, cycle detection at insert, and depth-budgeted decomposition
  belong to the claim-graph feature; FR-040 only requires that aggregation refuse a cyclic input.
- **AGENT-PROTOCOL-v3.md is the authority.** Where this spec and the protocol disagree, the
  protocol governs and this spec is corrected. Splitting the protocol into judgment instructions
  and an engine spec is part of this feature's work.
- **The registry is consumed, not built.** Source-reliability grades and structural classes arrive
  on the ledger as values. Building and versioning the registry is a separate feature.
- **Versions are independent.** Protocol version, engine version, schema version, and registry
  version each move on their own and are stamped separately.
- **No branch was created.** No `.specify/extensions.yml` is present, so no `before_specify` hook
  ran. The directory name `001-rule-engine-core` is the spec directory only.

## Dependencies

- **AGENT-PROTOCOL-v3.md** — the source of every tree, table, and threshold this engine encodes.
- **.specify/memory/constitution.md v1.0.0** — Principle I (Deterministic Verdicts) and Principle
  IV (The Schema Is the Contract) are the binding constraints on this feature; the Development
  Workflow section makes the fixture suite a merge gate and routes engine changes through
  methodology review.
- **No runtime dependencies.** By design, this feature depends on no service, no network, and no
  model.
