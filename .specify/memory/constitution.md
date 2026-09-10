<!--
SYNC IMPACT REPORT (temporary scratch material for human review; remove before commit)

Version change: none (unfilled template) -> 1.0.0
Bump rationale: Initial ratification. The prior file was the unmodified scaffold with all
placeholders intact, so this is a first adoption rather than an amendment.

Modified principles:
  [PRINCIPLE_1_NAME] -> I. Deterministic Verdicts
  [PRINCIPLE_2_NAME] -> II. Blind and Mirrored Judgment
  [PRINCIPLE_3_NAME] -> III. Full Trace, Public and Contestable
  [PRINCIPLE_4_NAME] -> IV. The Schema Is the Contract
  [PRINCIPLE_5_NAME] -> V. Fetched Content Is Data, Never Instruction
  (added)            -> VI. Harm Gate Before Spend

Added sections:
  Architecture and Cost Constraints  (from [SECTION_2_NAME])
  Development Workflow and Quality Gates  (from [SECTION_3_NAME])
  Principle VI - the scaffold carries five principle slots; a sixth was added because the intake
  gate and the registry-defamation constraint are non-negotiable and fit no other principle.

Removed sections: none

Deferred / follow-up TODOs: none. All placeholder tokens resolved.

Sources of derivation: GROUNDTRUTH-PLATFORM-BRIEF-v0.2.md (sections 2-15, decision log 19),
AGENT-PROTOCOL-v3.md (binding rules, Steps 1-5).
-->

# GroundTruth Execution Platform Constitution

## Core Principles

### I. Deterministic Verdicts (NON-NEGOTIABLE)

The band MUST be computed by code from a populated schema. No LLM may select, name, or influence
a band directly.

- The judgment layer (LLM skills) MUST own only: origin identification, warrant grade, whether a
  trigger fired and by what named mechanism, C/I/N diagnosticity marks, and contamination-channel
  calls.
- The rule engine (deterministic code) MUST own all four decision trees, band assignment,
  aggregation by minimum, demotion tables, cluster arithmetic, and every ceiling, including Tree
  3's cap at Probable.
- The engine MUST emit the tree used, the conditions met, and the specific conditions that capped
  the band, for every run.
- Verdicts MUST NOT carry a numeric score or percentage equivalent. Bands are conduct-guiding
  categories and MUST be displayed with their definition inline.

Rationale: this makes the system structurally incapable of overclaiming, which is a far stronger
guarantee than instructing a model not to overclaim or catching it afterward with a judge. It also
makes the methodology testable with fixtures and zero API calls.

### II. Blind and Mirrored Judgment (NON-NEGOTIABLE)

Origins MUST be graded blind to which side of the ledger they land on.

- The warrant-grading skill MUST receive the origin and the signalling questions, and MUST NOT
  receive the claim's direction, whether this origin supports or opposes it, or the running ledger
  state.
- D3 (indirectness) MAY receive the claim text explicitly and narrowly to assess proxy distance;
  it MUST NOT receive direction or ledger state.
- The burden of proof MUST rest on the claimant. Absence of disproof is never support; a claim
  with no surviving evidence is Unsupported, never Contested and never Refuted.
- Every factual lookup MUST be verified against live sources at evaluation time. Model training
  memory MAY generate hypotheses and rival explanations; it MUST NOT serve as evidence.

Rationale: the mirror rule becomes an architectural property rather than an instruction. A model
cannot apply a double standard to evidence whose side it cannot see. This is the strongest answer
available when a skeptical reviewer asks why the standards were applied evenly.

### III. Full Trace, Public and Contestable

Every run MUST ship an auditable trace, and every published finding MUST be attackable at the
field level.

- The process view (which skill did what, which sources were pulled, where each judge intervened
  and why) is a launch requirement, not a later addition. Shipping a verdict view alone is a
  violation.
- Every run MUST stamp protocol_version, engine_version, registry_version, model_ids, run_id, and
  requester.
- All runs MUST be public and attributed. The displayed band MUST NOT be simply the most recent
  run; repeat runs on an unchanged evidence base MUST surface as a stability record.
- Users MUST be able to challenge a specific schema node. The challenge, its outcome, and the
  resulting band change or non-change MUST attach to the report permanently. Rejected challenges
  MUST stay visible with their reason.
- When remediation exhausts its attempt budget, the run MUST complete carrying a visible
  unresolved-violation flag and an engine-capped band. Failures MUST NOT be hidden or silently
  dropped.

Rationale: a wrong verdict people can audit is worth more than a right one they cannot. This is
the property that makes the system a protocol rather than an oracle.

### IV. The Schema Is the Contract

The typed output schema MUST mediate every interaction between steps.

- Each skill MUST read a defined slice and write a defined slice. Steps MUST NOT share
  conversation state or pass context outside the schema.
- The schema MUST be versioned. Core fields MUST be frozen early and extended only through
  per-tree extension blocks.
- Any schema change MUST ship with a migration for stored runs and a version bump. Changes that
  invalidate stored runs without a migration are prohibited.
- Claim identity MUST be the Step 1 canonical restatement. Byte-identical canonical forms
  auto-link; anything short of identical MUST be confirmed by a human before linking.

Rationale: the schema is the contract between every skill, the engine, the dashboard, and the
stored corpus. Dedupe and schema failures corrupt graph topology, which counts the same evidence
twice under two names - a silent, systematic error.

### V. Fetched Content Is Data, Never Instruction

Retrieved evidence MUST be contained before it reaches any judgment step.

- Every fetch MUST be archived with content hash, timestamp, HTTP status, and final URL.
- Content MUST reach a skill only inside a delimited, explicitly-untrusted data block, never in an
  instruction position.
- Steps MUST cite sources by id and quote verbatim, and MUST report any embedded directive as a
  provenance finding.
- A judge check MUST report whether a step's output echoes instruction-shaped content from a
  source, so injection attempts are detected and not merely contained.
- Deterministic validators MUST be able to re-check origins offline from snapshots, with no
  re-fetch.

Rationale: adversarial pages steering judgment mid-research is a live attack, and a trace that is
only a list of URLs is worthless in six months. One mechanism serves containment, auditability,
and offline revalidation together.

### VI. Harm Gate Before Spend

Claim intake MUST be filtered before any API spend, and the system MUST hold its own reference
material to its own standard.

- A pre-flight classifier MUST reject claims that name a private individual, target a person's
  private life, or are not falsifiable-shaped. Public figures are in scope only on public conduct
  in their public role.
- Rejections MUST state the rule that fired, so the boundary is inspectable rather than a silent
  filter.
- Structural registry classes (aggregator, press_release, preprint, paywalled) are curated,
  definitional config.
- Evidential reliability grades, Poor and Fabricator in particular, are factual claims about
  organizations and MUST exist as claim nodes with their own evidence, band, and trace,
  contestable through the same challenge mechanism as anything else. The system MUST NOT assert a
  reliability grade it could not defend by its own protocol.

Rationale: a confident-sounding automated verdict about a named person is the single
highest-consequence failure this system can produce, and publishing "Fabricator" about an
organization is a defamation surface in its own right. Both gates are written before launch, not
after an incident.

## Architecture and Cost Constraints

- **Single store.** Postgres with pgvector holds the claim graph, run schemas as jsonb, traces,
  snapshots, and embeddings. A separate vector or graph service MUST NOT be introduced until the
  graph is demonstrably deep enough to require it.
- **The graph is a DAG.** Cycle detection MUST run at edge-insert time. Mutually load-bearing
  claims make band computation non-terminating and MUST be rejected at insert.
- **Recursion is bounded.** Auto-decomposition follows LOAD_BEARING edges only, to depth 2-3.
  SUPPLEMENTARY sub-claims are recorded as nodes but not evaluated unless separately requested. At
  the depth limit a sub-claim becomes a frontier node. Spend MUST be bounded before a run starts.
- **Staleness propagates by recomputation, not re-running.** When a child band changes, ancestor
  bands MUST recompute from the new child band at zero API cost. Ancestor evidence and judgments
  are untouched.
- **Token cost is the governing cost.** It dwarfs hosting from the first hundred claims. Prompt
  caching (stable step-instruction prefixes, volatile per-origin suffixes) and model tiering by
  step are required optimizations, not optional ones. Cost per claim MUST be measured against real
  runs before tiering decisions are fixed.
- **Node merges are destructive.** Adding an alias is open to requesters. Merging nodes rewrites
  topology and MUST remain behind curation review.
- **Hosting stays at the phase it needs.** Phase 1 is a read-mostly site over the database with
  the worker running locally or in CI; the pipeline MUST NOT be hosted before public BYOK runs
  require it.

## Development Workflow and Quality Gates

- **The fixture suite is the correctness foundation.** Hand-worked cases from the protocol spec
  MUST verify that the engine reproduces the bands the spec requires. It MUST run with zero API
  calls and MUST pass before any engine change merges.
- **Deterministic checks run on every run.** At minimum: every origin has a retrievable URL, fetch
  timestamp, and content hash; no origin's domain is classed aggregator; cluster count equals the
  number of partitions; assertion-grade lines contribute zero weight; non-diagnostic lines are
  excluded from cluster thresholds; every fired trigger has a named mechanism; the band matches
  what the engine computes; Tree 3 is not above Probable; Tree 2 has a temporality finding.
- **Engine and registry changes are methodology changes.** The rule engine and the source registry
  are not app code. Changes to either MUST go through methodology review, separately from ordinary
  application-code review. Registry changes are reputation-affecting and MUST be treated as such.
- **Remediation is bounded.** A failed step re-runs with the specific violation quoted back to it,
  up to a fixed attempt limit. That limit MUST be set from observed failure modes, not guessed.
  The trace MUST show every attempt.
- **Judge tiering is resolved by measurement.** Which judges need Opus-tier and which are
  Sonnet-adequate MUST be decided against measured outcomes, not assumption.
- **Every skill is independently versionable and evaluable.** A weak step MUST be isolatable,
  measurable, and fixable without touching the others.

## Governance

This constitution supersedes all other development practices for this repository. Where a plan,
spec, task list, or code review conflicts with it, this document wins and the conflicting artifact
MUST be revised.

**Amendment procedure.** Amendments MUST be proposed as a change to this file, MUST state the
principle or section affected, MUST include the rationale, and MUST carry a migration note when
they invalidate existing runs, stored schemas, or published verdicts. Amendments touching
Principles I, II, or VI additionally require explicit sign-off from the project owner, because
those three encode the guarantees the platform's public credibility rests on.

**Versioning policy.** This constitution uses semantic versioning:

- MAJOR - a principle is removed or redefined in a backward-incompatible way, or governance rules
  change such that previously compliant work becomes non-compliant.
- MINOR - a principle or section is added, or existing guidance is materially expanded.
- PATCH - clarifications, wording, and non-semantic refinements.

Protocol version, engine version, registry version, and schema version are versioned separately
from this document and are stamped on every run, so old verdicts stay reproducible against the
rules that produced them.

**Compliance review.** Every pull request MUST verify compliance with these principles, and the
reviewer MUST name any principle the change touches. Complexity that departs from the constraints
above MUST be justified in writing at review time; unjustified complexity is grounds for
rejection. Runtime development guidance lives in GROUNDTRUTH-PLATFORM-BRIEF-v0.2.md (architecture
and phased plan) and AGENT-PROTOCOL-v3.md (judgment instructions and rule engine spec); both are
subordinate to this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-09-10 | **Last Amended**: 2026-09-10
