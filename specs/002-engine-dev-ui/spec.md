# Feature Specification: Rule Engine Dev UI

**Feature Branch**: `002-engine-dev-ui`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "A frontend to both input requests and view outputs for the deterministic rule engine — paste or build a ledger, run it, and see the verdict, as a dev/reviewer tool rather than the public claim-submission site."

## Clarifications

### Session 2026-09-12

- Q: Should ledger generation via an LLM (turning a raw claim into a populated ledger) be built into this tool? → A: No — that is a separate, future feature (planned as `003-judgment-pipeline-mvp`, LLM-backed via Gemini's free API tier rather than the Claude API, since a Claude Pro subscription doesn't include API access). This spec's scope is unchanged: paste or load an already-populated ledger, run it, see the verdict — zero LLM calls, zero network requests. That future pipeline feature will need to support users supplying their own API key (BYOK), so that running it doesn't put every user's cost on one person; recorded here so the requirement carries forward into that feature's spec.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Evaluate a pasted ledger (Priority: P1) 🎯 MVP

A developer or methodology reviewer pastes or types a ledger as JSON, runs it through the rule
engine, and immediately sees the resulting verdict — band, qualifier, which tree produced it,
every condition that was met, and every condition that capped it below the tree's ceiling —
without writing any code themselves.

**Why this priority**: This is the entire value proposition. Today, running the engine means
writing a TypeScript fixture file and running the test suite. This collapses that to paste-and-see.

**Independent Test**: Paste the `input` value from any of the engine's existing fixture cases;
confirm the displayed band, qualifier, and tree match that fixture's `expected` value exactly.

**Acceptance Scenarios**:

1. **Given** a syntactically valid, schema-valid ledger pasted into the input area, **When** the
   user runs it, **Then** the verdict's band, qualifier, tree, conditions met, and capping
   conditions are all displayed, with each condition's protocol-clause text shown in full.
2. **Given** text that is not valid JSON, **When** the user runs it, **Then** the tool shows a
   specific parse error without attempting to call the engine.
3. **Given** valid JSON that fails the engine's own schema validation (e.g. a missing required
   field), **When** the user runs it, **Then** the tool displays the engine's own refusal reason
   verbatim, visually distinguished from a computed verdict.
4. **Given** a verdict whose band is below its tree's highest reachable band, **When** it is
   displayed, **Then** at least one capping condition is shown — never a lower band with no stated
   reason.

---

### User Story 2 - Start from a known fixture (Priority: P2)

A reviewer browses the engine's existing hand-worked fixture cases by id and protocol clause,
loads one into the input area, and can then modify it to explore variations without writing a
ledger from scratch.

**Why this priority**: Hand-writing a full ledger against the schema is tedious and error-prone.
Starting from a known-good example that already reproduces a specific protocol clause lowers the
barrier to using the tool at all — without it, User Story 1 is only useful to someone who already
knows the schema by heart.

**Independent Test**: Select any existing fixture case from the list; confirm the input area is
populated with that exact ledger and, on running it, reproduces that fixture's expected verdict.

**Acceptance Scenarios**:

1. **Given** the list of existing fixture cases, **When** the user selects one, **Then** the input
   area is populated with that fixture's ledger and its protocol clause is shown alongside it.
2. **Given** a loaded fixture, **When** the user edits a field and re-runs it, **Then** the new
   verdict reflects the edit and the original fixture file on disk is unchanged.

---

### User Story 3 - Evaluate a compound (aggregation) claim (Priority: P3)

A reviewer defines a small set of sub-claims — each with a band and load-bearing/supplementary
status — and any dependency edges between them, runs aggregation, and sees the resulting compound
verdict.

**Why this priority**: Aggregation takes a materially different input shape than single-claim
evaluation and is exercised less often. It extends the same tool naturally but isn't needed for
the tool to already be useful — User Stories 1 and 2 stand on their own.

**Independent Test**: Paste the input from any of the engine's existing aggregation fixture cases;
confirm the displayed band and, where applicable, `movedBy` match that fixture's expected value.

**Acceptance Scenarios**:

1. **Given** a compound input whose sub-claim structure contains a cycle, **When** the user runs
   it, **Then** the tool displays the engine's cycle-refusal message rather than an error page.
2. **Given** a compound input and a previous sub-claim state differing in exactly one sub-claim's
   band, **When** both are supplied, **Then** the displayed verdict names which sub-claim moved
   the result.

---

### Edge Cases

- What happens when the input area is empty and the user runs it?
- What happens with an unusually large ledger (hundreds of origins)? The tool should stay
  responsive to typing and running.
- What happens when the user switches between evaluate and aggregate mode with unsaved edits in
  the input area?
- How are two fixture cases with very similar ids distinguished in the list?
- What happens when the engine itself changes (a new engine version) after the tool was loaded?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a text input area where users can paste or type a ledger as
  JSON.
- **FR-002**: System MUST require an explicit user action to run the current input, rather than
  evaluating on every keystroke, so an incomplete edit is never mistaken for a valid result.
- **FR-003**: System MUST run the pasted input through the engine's existing single-claim
  evaluation path unmodified — the displayed verdict MUST be identical to what a fixture-suite run
  of the same input would produce.
- **FR-004**: System MUST display, for every verdict: the band, the qualifier (when present), the
  tree that produced it, every condition met, and every capping condition, with each condition's
  protocol-clause text shown in full.
- **FR-005**: System MUST display the engine version and schema version stamped on the verdict.
- **FR-006**: System MUST detect and display a specific, human-readable error when the input text
  is not valid JSON, without attempting to run the engine.
- **FR-007**: System MUST display the engine's own refusal reason verbatim when the engine refuses
  to produce a verdict, visually distinguished from a computed band.
- **FR-008**: System MUST provide a list of the engine's existing hand-worked fixture cases, each
  identified by its id and protocol clause.
- **FR-009**: Users MUST be able to select a fixture case from that list and have its ledger
  populate the input area exactly, without altering the underlying fixture file.
- **FR-010**: System MUST provide a mode for compound (aggregation) input, structurally distinct
  from single-claim evaluation, matching the engine's own `evaluate()`/`aggregate()` split.
- **FR-011**: In aggregate mode, System MUST allow the user to additionally supply a "previous"
  sub-claim state and display the resulting `movedBy` when the engine sets one.
- **FR-012**: System MUST perform every evaluation locally — producing a verdict MUST require zero
  network requests.
- **FR-013**: System MUST provide a way to copy the full verdict, as JSON, to the clipboard.
- **FR-014**: System MUST display the cluster/dependence map when the engine includes one on a
  single-claim verdict.

### Key Entities

- **Ledger Draft**: The user's current pasted or edited text, and its parsed form once valid. Not
  persisted between sessions unless the user explicitly copies it out.
- **Fixture Library Entry**: One of the engine's existing hand-worked fixture cases, identified by
  id and protocol clause; used only as a loadable starting point and never modified by the tool.
- **Verdict Display**: The rendered form of an engine verdict — band, qualifier, tree, conditions,
  capping conditions, version stamps, and, when present, dependence map or `movedBy`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can go from opening the tool to seeing a verdict for a hand-typed ledger
  in under one minute, without consulting any source code.
- **SC-002**: Loading and running each of the engine's existing fixture cases through the tool
  reproduces that fixture's expected band, qualifier, and tree exactly, 100% of the time.
- **SC-003**: 100% of verdicts displayed below their tree's ceiling show at least one
  human-readable capping condition — a reviewer never sees an unexplained lower-than-expected band.
- **SC-004**: A syntactically invalid input is diagnosed with a specific, actionable message in
  under one second, never a blank or crashed state.
- **SC-005**: Producing a verdict requires zero network requests, verified by running the tool
  with network access disabled.
- **SC-006**: A reviewer with no prior exposure to the tool can locate and load a specific fixture
  case, by protocol clause, in under 30 seconds.

## Assumptions

- This is an internal developer/reviewer tool, not the public-facing site described in the
  platform brief's Phase 1 "read-mostly site over the database." It has no user accounts, no
  claim intake, and is not subject to the Harm Gate (Constitution Principle VI), since it never
  triggers API spend or accepts a claim from the public.
- Automated ledger generation from a raw claim via an LLM is explicitly out of scope for this
  feature — see Clarifications above. That is a separate, future pipeline feature
  (`003-judgment-pipeline-mvp`), which is where the Harm Gate and any LLM API calls belong, and
  which must let each user supply their own API key (BYOK) rather than one person's key serving
  everyone.
- The input method for this version is a raw JSON text area validated against the engine's own
  schema, not a guided/structured form for every field. The target user is already comfortable
  with the `LedgerInput`/`CompoundInput` shapes — they're the same shapes the fixture files use
  today. A structured, field-by-field form is a possible future enhancement, out of scope here.
- Runs as a local development tool that a developer builds and opens, or serves via a local dev
  server. It does not need to be deployed anywhere for this feature to be complete, though nothing
  here precludes hosting it later.
- Saving an edited ledger back to disk as a new fixture case file is out of scope; copy-to-clipboard
  is sufficient for a developer to paste into a new fixture file by hand.
- No authentication or access control is needed, since this tool is not exposed publicly.
- Depends on the `001-rule-engine-core` feature's `evaluate()`/`aggregate()` functions and its
  existing fixture cases as the library this tool loads from.
