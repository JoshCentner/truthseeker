# Feature Specification: Claim Corpus Structure and Visual Claim Report

**Feature Branch**: `005-claim-corpus-report` *(no branch created — no `before_specify` git hook is registered in this repo)*

**Created**: 2026-09-15

**Status**: Draft

**Input**: User description: "Claim corpus structure and visual claim report. Two halves, both needed for the read-mostly public site the constitution names as Phase 1. HALF ONE — the corpus becomes a graph of claim folders... HALF TWO — a visual HTML report for ONE given claim, rendered from that claim folder..."

## Clarifications

### Session 2026-09-16

- Q: When a stored run predates the current engine version, which band does the report show? → A: Show the band as that run recorded it, stamped with its engine version; when today's engine computes a different band from the same ledger, flag the record as superseded and show both.
- Q: Should runs that ended without a verdict be stored in the corpus and rendered? → A: Yes for rejected, needs_review and needs_clarification, which are findings about the claim; exclude auth_failed, which is a fact about the operator's key.
- Q: How much protocol vocabulary should the claim page define for a lay reader? → A: Plain-language phrasing leads with the exact protocol term shown alongside it, plus an on-page glossary; no term is replaced or hidden.
- Q: How much Markdown formatting should authored claim files render, and is raw HTML allowed? → A: A restricted subset (headings, emphasis, lists, links, code, quotes) with raw HTML stripped, every run-record string escaped, and only http/https links made clickable.
- Q: What happens when a claim's canonical restatement is edited after runs exist against it? → A: It is frozen once a run is recorded; rewording creates a new claim folder linked to the old one by a human-confirmed supersedes edge.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A skeptical reader judges a verdict for themselves (Priority: P1)

A person arrives at a claim's report page knowing nothing about the platform. They can see what the
system concluded, what that conclusion is defined to mean, which sources it rests on, what argued
the other way, and exactly which conditions the engine recorded as holding the band where it is.
Crucially they can also see *how the verdict was produced* — every step that ran, every source
pulled, every attempt a step needed — so they can attack the reasoning rather than having to
either trust or reject a bare label.

**Why this priority**: This is the product. Constitution Principle III states that "a wrong verdict
people can audit is worth more than a right one they cannot," and that shipping a verdict view
without the process view is a violation. Nothing else in this feature has value if this page does
not read well, which is why the first pass is deliberately one claim rendered design-first.

**Independent Test**: Render the existing Great Wall record and hand the page to someone who has
not seen the project. They can state the band, its definition, one source it rests on, and one
thing that was argued against it, without asking a question.

**Acceptance Scenarios**:

1. **Given** a claim folder holding one completed run record, **When** the report is generated,
   **Then** the page shows the band together with its definition in the same view, and no numeric
   score or percentage appears anywhere on it.
2. **Given** a run whose ledger contains origins that could not be retrieved, **When** the report is
   generated, **Then** those origins appear on the page marked as unretrieved rather than being
   omitted.
3. **Given** a run record produced through the manual-run harness, **When** the report is generated,
   **Then** the provenance and its blindness caveat are visible without the reader interacting with
   the page.
4. **Given** a run whose trace contains failed remediation attempts, **When** the report is
   generated, **Then** every attempt appears, including the ones that failed and the violation each
   reported.
5. **Given** a verdict carrying capping conditions, **When** the report is generated, **Then** each
   capping condition is shown with the clause the engine recorded for it.

---

### User Story 2 - A contributor records a sub-claim and its relationship (Priority: P2)

A contributor decomposes a claim and records a sub-claim. The sub-claim gets its own directory as a
sibling of every other claim — never nested inside its parent — and declares in its own authored
metadata which claim it belongs to and by what kind of edge. Both claims remain first-class: either
can be read, run, or cited on its own, and the relationship is visible from the sub-claim's page.

**Why this priority**: The graph is what turns a pile of verdicts into a corpus, and getting the
shape wrong is expensive to undo later — the constitution warns that topology errors "count the
same evidence twice under two names, a silent, systematic error." It is P2 rather than P1 because
the report page delivers value against a single claim before any relationship exists.

**Independent Test**: Add a sub-claim folder declaring a parent, regenerate, and confirm it sits as
a sibling directory, that its relationship resolves to the named parent, and that a relationship
naming a non-existent claim fails loudly.

**Acceptance Scenarios**:

1. **Given** a sub-claim declaring a primary claim and an edge type, **When** the corpus is read,
   **Then** the relationship resolves and both claims are siblings on disk at the same level.
2. **Given** a sub-claim whose declared parent does not exist, **When** the corpus is read, **Then**
   the read fails naming the missing claim, rather than silently dropping the edge.
3. **Given** relationships that would form a cycle, **When** the corpus is read, **Then** the read
   fails and names the claims participating in the cycle.
4. **Given** a claim with a parent or sub-claims, **When** its report is generated, **Then** those
   relationships appear as navigable links with their edge type stated.

---

### User Story 3 - A contributor regenerates the site from a fresh clone (Priority: P3)

Someone who has just cloned the repository, with no API key and no network access, can regenerate
the report for any claim in the corpus and get byte-identical output to what anyone else would get
from the same corpus.

**Why this priority**: This is the whole premise of the contribution model — people download the
repo, add claims, and open a pull request. It is P3 only because it is a property of the renderer
rather than a separate thing to build, and it is verified as soon as US1 works.

**Independent Test**: Clone clean, disable networking, run the renderer, and diff the output against
the committed expectation.

**Acceptance Scenarios**:

1. **Given** a fresh clone with no key configured and networking disabled, **When** the renderer is
   run against a claim, **Then** it completes successfully and makes no outbound request.
2. **Given** the same corpus rendered twice, **When** the outputs are compared, **Then** they are
   identical apart from any explicitly-stamped generation timestamp.

---

### Edge Cases

- **A band is hand-written into an authored metadata block.** It must never reach the page. Principle
  I requires the band to be computed by code from a populated schema; if a human can type a band
  into a Markdown file and have it displayed, that guarantee is gone. The read fails and names the
  offending file rather than preferring the computed value silently.
- **A claim folder has no run record yet.** The claim is legitimate but has no verdict; the page
  must say so explicitly rather than rendering an empty or implied band.
- **A claim's only runs ended without a verdict.** Also legitimate. The page shows the outcome — the
  rule that fired, the reason queued, or the step that exhausted its attempts — and no band. It is
  never rendered as though the claim were unevaluated or absent.
- **A claim was rejected by the harm gate.** Its page is still published, because a rejection nobody
  can see is the silent filter Principle VI exists to prevent. What is published is the stated rule,
  not a restatement of whatever was alleged.
- **A claim folder holds several run records.** Covered by FR-029/FR-029a: the newest band leads,
  the stability record sits beside it, and disagreement among runs on one evidence base is surfaced
  at the band rather than buried in a list.
- **Two runs share an evidence base but reached different bands.** This is the case FR-029a exists
  for, and it is the one where a naive "show the latest" would mislead most.
- **A contributor fixes a typo in a restatement that already has runs.** Rejected under FR-007a.
  The fix is a new claim folder superseding the old one — deliberately more friction than editing a
  line, because the alternative is evidence silently answering a different question.
- **A claim is superseded.** Its page stays published with its evidence and verdict intact and links
  forward to its replacement. Nothing is withdrawn, because citations already made against it must
  not break.
- **Two claim folders carry byte-identical canonical restatements.** They are the same claim and must
  auto-link; anything short of byte-identical must not be merged without a human confirming it.
- **A protocol term appears on a page with no plain-language definition written for it yet.** The
  page must not fall back to showing the bare identifier as though it were self-explanatory; an
  undefined term is a gap to be filled, and generation should surface it rather than pass it
  through.
- **A canonical restatement is long, non-Latin, or contains characters a filesystem rejects.** The
  directory name must remain stable and collision-free without the restatement itself being altered.
- **An authored Markdown file contains content that looks like an instruction to a model.** Authored
  and fetched content both render as data; nothing on the page is executable or treated as an
  instruction.
- **A fetched source's title, URL or quoted reasoning contains markup.** The constitution already
  requires fetched content to be data and never instruction where a model is concerned; the same
  content reaching a browser is the same problem one layer down. It is escaped, never rendered as
  markup, however it arrived.
- **An authored file links to a `javascript:` or `data:` URL.** Displayed as inert text, never as a
  clickable link.
- **The current engine disagrees with a stored record.** Expected, not exceptional: an engine
  version bump on 2026-09-15 moved an existing record from Contested to Refuted off an unchanged
  ledger. FR-032 requires both bands on the page rather than a silent rewrite in either direction.
- **A run record carries an unresolved-violation flag.** It must be visible on the page, since the
  constitution requires exhausted remediation to surface rather than be hidden.

## Requirements *(mandatory)*

### Functional Requirements

#### Corpus structure

- **FR-001**: Every claim MUST be represented as its own directory within a single claims container,
  and every claim directory MUST be a sibling of every other claim directory.
- **FR-002**: The directory layout MUST NOT encode claim relationships. Nesting one claim inside
  another MUST NOT be possible as a way of expressing that one is a sub-claim of the other.
- **FR-003**: Each claim directory MUST contain exactly one canonical claim record file carrying that
  claim's authored metadata.
- **FR-004**: A claim directory MUST be able to hold additional authored Markdown files beyond the
  canonical record, without those files changing the claim's identity or verdict.
- **FR-005**: A sub-claim MUST declare its relationship in its own authored metadata, naming the
  claim it belongs to and the edge type.
- **FR-006**: Sub-claim edge types MUST be limited to the constitution's existing vocabulary:
  load-bearing and supplementary. The supersedes relationship of FR-007b is a distinct relation
  between two versions of one claim rather than a sub-claim edge, and MUST NOT be usable where a
  sub-claim edge type is expected.
- **FR-007**: A claim's identity MUST be its canonical restatement. Byte-identical restatements MUST
  auto-link as the same claim; restatements short of byte-identical MUST NOT be linked without
  explicit human confirmation.
- **FR-007a**: Once a claim holds at least one run record, its canonical restatement MUST be
  immutable. An attempt to change it MUST fail the read, naming the claim and both texts. Evidence
  MUST NOT be able to migrate to a differently-worded proposition, which is the "same evidence under
  two names" corruption the constitution identifies as a silent, systematic error.
- **FR-007b**: A reworded claim MUST be recorded as a new claim folder. It MAY be linked to the
  claim it replaces by a supersedes relationship, which — like any non-byte-identical link — MUST
  require explicit human confirmation and MUST NOT be inferred from textual similarity.
- **FR-007c**: A supersedes relationship MUST be visible from both claims: the superseded claim's
  report MUST link forward to its replacement, and the replacement MUST link back. A superseded
  claim's page MUST remain published with its evidence and verdict intact, since withdrawing it
  would break any citation already made against it.
- **FR-007d**: Where a run record's stored claim text differs from its claim's canonical
  restatement, the read MUST fail. Under FR-007a this should be unreachable; it is checked because
  a mismatch means the corpus has been edited in a way that invalidates the evidence linkage, and
  failing loudly is the only safe response.
- **FR-008**: A claim's directory name MUST be derived deterministically from its canonical
  restatement, MUST remain stable across regenerations, and MUST resolve collisions without altering
  either claim's restatement.
- **FR-009**: Machine-readable run records MUST live inside their claim's directory and MUST retain
  the complete result, verdict and provenance they already carry.
- **FR-009a**: A run that ended without a verdict MUST be storable as a first-class run record —
  specifically a harm-gate rejection, a review-queue hold, and a run that exhausted its remediation
  budget. A claim whose only runs ended this way is a legitimate claim with no verdict, not an
  absent claim.
- **FR-009b**: A run that failed because the operator's credentials were rejected MUST NOT be stored
  in the corpus. It carries no finding about the claim and exposes operational detail about whoever
  ran it.
- **FR-010**: Reading the corpus MUST validate that the relationship graph is acyclic, and MUST fail
  naming the participating claims when it is not.
- **FR-011**: A relationship naming a claim that does not exist MUST fail the read, naming the
  missing claim. It MUST NOT be silently dropped.
- **FR-012**: A band, qualifier, or any other engine-computed field appearing in authored metadata
  MUST fail the read, naming the file and field. Authored metadata MUST have no path to influencing
  a displayed verdict.
- **FR-013**: Generated content MUST be visibly distinguishable from authored content wherever both
  appear, so a contributor can tell at a glance what they may edit.

#### The claim report

- **FR-013a**: Where the displayed run ended without a verdict, the report MUST show that outcome in
  place of a band, and MUST NOT imply a verdict exists. Specifically: a rejection MUST state the
  rule that fired, a review-queue hold MUST state the reason it was queued, and an exhausted
  remediation MUST state the step that ran out of attempts and the questions it raised.
- **FR-013b**: A rejected claim's page MUST remain publicly readable. The rejection boundary is
  inspectable by design: a reader must be able to see what the intake gate turned away and on what
  stated rule, without needing access to any operational log.

- **FR-014**: The report MUST show the claim's band together with the band's definition in the same
  view, never a band label alone.
- **FR-015**: The report MUST NOT display a numeric score, percentage, confidence number, or any
  other numeric equivalent of the band.
- **FR-015a**: Every protocol term the report displays — warrant grades, diagnosticity marks,
  reliability grades, fired triggers, edge types, and engine condition identifiers — MUST be
  rendered in plain language with the exact protocol term shown alongside it. The protocol term MUST
  NOT be replaced or omitted, because a challenger has to be able to cite the precise field, and a
  plain-language paraphrase alone is not citable.
- **FR-015b**: The report MUST carry a glossary of every protocol term appearing on that page.
- **FR-015c**: Plain-language renderings MUST come from a single shared definition per term, so the
  same protocol term never appears worded two different ways across the page or across claims.
- **FR-016**: The report MUST list every origin in the ledger with its retrievable URL, retrieval
  status, warrant grade, source reliability grade, and any fired triggers with their named
  mechanisms.
- **FR-017**: The report MUST show each line's diagnosticity, distinguishing lines that support the
  claim, lines that contradict it, and lines that bear on neither.
- **FR-018**: The report MUST list every rival with its description, whether it was rebutted, and its
  plausibility relative to the claim.
- **FR-019**: The report MUST list the conditions the engine recorded as met and, separately, the
  conditions it recorded as capping the band, each with its recorded clause.
- **FR-020**: The report MUST show the process view: which steps ran in what order, which sources
  were pulled, and every remediation attempt including failed ones and the violation each reported.
- **FR-021**: The report MUST display the run's stamps — run identifier, requester, model
  identifiers, and engine and schema versions.
- **FR-022**: The report MUST display each run's provenance, and where a record carries a caveat
  about how it was produced, that caveat MUST be visible without requiring interaction.
- **FR-023**: The report MUST render a claim's parent and sub-claim relationships as navigable links
  stating the edge type.
- **FR-024**: The report MUST state which run record it was generated from.
- **FR-025**: Where a run carries an unresolved-violation flag, the report MUST display it.
- **FR-026**: The report MUST remain readable and usable at phone width as well as on a desktop.
- **FR-027**: Origins that could not be retrieved MUST appear on the page marked as such, never
  omitted.

#### Rendering safety

- **FR-027a**: Authored Markdown MUST render as a restricted subset — headings, emphasis, lists,
  links, inline and block code, and block quotes. Raw HTML in an authored file MUST be stripped, not
  escaped-and-shown and not passed through.
- **FR-027b**: Every string originating from a run record MUST be escaped before it reaches the
  page. This explicitly includes origin URLs and identifiers, model reasoning, fired-trigger
  mechanisms, weakness descriptions, rival descriptions and requester names — anything that may have
  been derived from a fetched page rather than written by the project.
- **FR-027c**: Only `http` and `https` URLs MAY be rendered as clickable links. A URL with any
  other scheme MUST be displayed as inert text.
- **FR-027d**: A generated page MUST contain no executable script and MUST require no network fetch
  to display. Its content is a record, and a record does not need to run anything to be read.

#### Generation

- **FR-028**: Generating a report MUST require no API key and MUST make no network request.
- **FR-029**: Where a claim has more than one run record, the report MUST display the most recent
  run's band as the claim's current verdict, and MUST display a stability record *alongside* that
  band rather than below it, listing every run against the claim with its date, engine version and
  band.
- **FR-029a**: Where any earlier run sharing the displayed run's evidence base reached a different
  band, the report MUST surface that disagreement adjacent to the band itself. It MUST NOT leave the
  disagreement to be inferred by a reader comparing rows in the stability record. This is what keeps
  FR-029 compliant with the constitution's requirement that the displayed band "MUST NOT be simply
  the most recent run": the most recent band is the headline, but an unstable headline is never
  shown without its instability.
- **FR-029b**: Two runs MUST be treated as sharing an evidence base when their ledgers reference the
  same set of origin identifiers with the same retrieval statuses and the same retraction flags. Any
  difference in that set means the evidence base changed.
- **FR-030**: Generation MUST be deterministic: the same corpus MUST produce the same output apart
  from an explicitly-stamped generation timestamp.
- **FR-031**: The band a report displays MUST be the band the run record itself carries, shown
  together with the engine version that produced it. The report MUST NOT silently substitute a band
  computed at generation time, because every run is stamped with its engine version precisely so
  that old verdicts stay reproducible against the rules that produced them.
- **FR-032**: At generation time the report MUST recompute the band from the run's ledger using the
  current engine, and where that differs from the recorded band, MUST mark the record superseded and
  display both bands with their respective engine versions. Methodology drift MUST be visible on the
  page rather than discoverable only by re-running.
- **FR-033**: Where a run record's schema version is one the current engine cannot read, the report
  MUST display the recorded band and state that the drift check could not be performed, rather than
  omitting the check silently or failing the page.

### Key Entities

- **Claim**: A directory holding one claim. Identified by its canonical restatement. Sibling to every
  other claim regardless of relationships.
- **Claim record**: The canonical authored Markdown file in a claim directory. Carries the
  restatement, any declared relationship to another claim, aliases, and human notes. Carries no
  engine-computed field.
- **Supplementary claim file**: Any additional authored Markdown in a claim directory — notes,
  challenges, correspondence. Does not affect identity or verdict.
- **Relationship**: A directed edge between claims, declared on the dependent claim. A sub-claim
  declares a load-bearing or supplementary edge to its primary claim; a reworded claim declares a
  supersedes edge to the claim it replaces. Every edge type must form a directed acyclic graph.
- **Run record**: An existing machine-readable record of one pipeline run, stored inside its
  claim's directory. A run that reached a verdict carries result, ledger, trace, verdict and
  provenance. A run that ended without one carries its outcome and the reason for it — the rule that
  fired, the reason queued, or the step that exhausted its attempts — and has no ledger or band.
- **Report**: The generated page for one claim, derived from that claim's authored files and run
  records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader unfamiliar with the project can state the claim's band, its meaning, one
  source the verdict rests on, and one point argued against it, within two minutes of opening the
  page and without asking a question.
- **SC-001b**: A reader can state, in their own words, why any single piece of evidence on the page
  counted for as much or as little as it did, without looking anything up off the page.
- **SC-001c**: Every protocol term rendered on a page appears in that page's glossary — no term is
  displayed without a definition available on the same page.
- **SC-001a**: For a claim whose run ended without a verdict, a reader can state what happened to
  it and why, and cannot mistake it for a claim that was evaluated and found wanting.
- **SC-002**: 100% of origins in a run's ledger appear on the page with a URL and a retrieval status,
  including those that could not be retrieved.
- **SC-003**: Zero numeric scores, percentages or confidence numbers appear anywhere on a generated
  report.
- **SC-003a**: A claim folder whose authored Markdown and whose run-record strings both contain
  script tags, event-handler attributes and non-http URL schemes generates a page that executes
  nothing, renders no markup from either source, and makes no network request when opened.
- **SC-004**: 100% of remediation attempts recorded in a run's trace appear on the page, including
  failed attempts.
- **SC-005**: A record carrying a provenance caveat displays that caveat without the reader scrolling
  past the verdict or interacting with any control.
- **SC-006**: A band written by hand into authored metadata never appears on a generated page; the
  attempt fails the read and names the file.
- **SC-007**: A relationship cycle fails the read and names every claim in the cycle.
- **SC-007a**: An attempt to alter the canonical restatement of a claim that already holds a run
  fails the read, naming the claim and both versions of the text.
- **SC-007b**: From a superseded claim's report a reader reaches its replacement in one step, and
  from the replacement reaches what it superseded.
- **SC-008**: From a sub-claim's report, a reader can reach its primary claim's report in one step,
  and the edge type is stated.
- **SC-009**: Report generation completes with networking disabled and no key present.
- **SC-010**: Two generations from an unchanged corpus differ only in an explicitly-stamped
  generation timestamp.
- **SC-011a**: Where the current engine computes a band different from a record's, both bands and
  both engine versions appear on the page, and a reader can tell which one the current methodology
  produces without consulting the repository.
- **SC-011**: For a claim with more than one run, every run appears in the stability record with its
  date and band, and where two runs on one evidence base disagree, a reader sees that disagreement
  at the band without scrolling to the stability record.

## Assumptions

- **No band is ever authored.** Every band that reaches a page was computed by the rule engine from
  a populated schema — either when the run was recorded (the displayed band, per FR-031) or at
  generation time as the drift check (FR-032). No band is ever read from authored text; that path is
  a hard failure under FR-012. The engine remains the only thing that may name a band.
- **Generated HTML is build output, not source.** It is regenerable from the corpus and is not
  committed, matching how the existing frontend build output is treated. The corpus — the Markdown
  and the run records — is the thing contributors commit and review.
- **A site-wide index across all claims is out of scope**, as is any cross-claim graph visualisation.
  This feature renders one claim at a time, design-first, so the page reads well before it is
  generalised.
- **The challenge mechanism is out of scope.** The constitution requires users to be able to contest
  a specific schema node, with the challenge and its outcome attaching permanently to the report.
  This feature makes the schema visible per field, which is a precondition for that, but does not
  build the submission, adjudication, or attachment workflow.
- **Migrating the two existing records into the new layout is in scope**, since leaving them in the
  old location would mean the renderer has nothing real to render.
- **Plain language is additive, never a substitute.** The protocol's exact vocabulary stays on the
  page next to its plain-language rendering. Paraphrasing a term away would make the page
  unciteable, and the ability to challenge one named field is a constitutional requirement this
  feature must not foreclose.
- **Readers are members of the public, not developers.** The page is written for someone evaluating
  a contested claim, not for someone debugging the pipeline, even though it exposes the full trace.
- **Authored Markdown is trusted-authorship but untrusted-content.** Contributors are identified via
  the pull request that adds their files, but pull-request review is not relied on as the control
  that keeps markup off the page — review attention is exactly what degrades as contribution volume
  grows. Nothing in a Markdown file is ever treated as an instruction by any part of the system, and
  nothing in one can introduce markup into a generated page.
- **Evidence-base comparison is limited to what a run record stores.** FR-029b compares origin
  identifiers, retrieval statuses and retraction flags, because those are what a stored run record
  carries. Content hashes live in the fetch archive rather than in the record, so a source that
  silently changed its content at the same URL between two runs would currently read as an unchanged
  evidence base. Closing that gap means carrying the hash into the record, which is a schema change
  and belongs to its own feature.
- **Aggregation across sub-claims is out of scope.** The engine already aggregates compound claims,
  but wiring a parent's band to recompute from its children's bands is separate work and is not
  required for a single claim's report to be correct.
