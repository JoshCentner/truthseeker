# Phase 1 Data Model: Rule Engine Core

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Types below are TypeScript shapes (see research.md §3 for the `LedgerInput`/`Verdict` split
rationale). Enum-like fields are string-literal unions, not numeric codes, per the constitution's
"categorical approaches over scoring" principle and FR-044's ban on numeric equivalents anywhere
in output.

## Shared enums

- `WarrantGrade`: `'assertion' | 'testimony' | 'contemporaneous_record' | 'physical_documentary'`
  — an ordered scale; `'physical_documentary'` is the ceiling no upgrade may cross (FR-013).
- `ReliabilityGrade`: `'fabricator' | 'poor' | 'mixed' | 'reliable' | 'not_rated'`.
- `ContaminationChannel`: `'data' | 'method' | 'institution' | 'motive'` (FR-016).
- `DiagnosticMark`: `'consistent' | 'inconsistent' | 'not_applicable'`.
- `AdversarialStatus`: `'survived' | 'untested'`.
- `ClaimType`: `'simple_factual' | 'causal' | 'predictive' | 'complex_system'`.
- `Band`: `'established' | 'probable' | 'contested' | 'doubtful' | 'unsupported' | 'refuted' | 'unresolvable' | 'unfalsifiable'`.
- `Qualifier`: `'insufficient_evidence' | 'conflicting_evidence'` — mandatory whenever `band === 'contested'` (FR-022).
- `TreeId`: `'tree1_simple_factual' | 'tree2_causal' | 'tree3_predictive' | 'tree4_complex_system' | 'aggregation' | 'screen'`
  (`'screen'` covers structural, pre-tree verdicts: Unfalsifiable).

## Origin

Where a piece of evidence first entered the record.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Unique within the ledger. |
| `retrievalStatus` | `'retrieved' \| 'could_not_retrieve'` | `'could_not_retrieve'` forces grading as bare assertion regardless of claimed type (FR-011). |
| `retracted` | `boolean` | `true` removes this origin's entire downstream line (FR-010). |
| `correctedFormOfId` | `string \| null` | If this origin corrects an earlier one, the earlier origin's id; the engine evaluates only the corrected form (FR-010). |

## Warrant

One origin's grading.

| Field | Type | Notes |
|---|---|---|
| `originId` | `string` | Links to `Origin.id`. |
| `startingGrade` | `WarrantGrade` | Pre-trigger grade. |
| `firedTriggers` | `{ direction: 'upgrade' \| 'downgrade'; mechanism: string }[]` | Every entry MUST carry a non-empty `mechanism`; the engine rejects any trigger without one (FR-012). One grade step per downgrade trigger, no limit (FR-012); upgrades never cross `'physical_documentary'` (FR-013). |
| `interestedParty` | `boolean` | Gates the interested-party table (FR-014). |
| `partyControlledCreationAfterStakesVisible` | `boolean` | Only relevant when `startingGrade === 'contemporaneous_record'` and `interestedParty === true`; demotes to `'testimony'` when true (FR-014). |
| `sourceReliabilityGrade` | `ReliabilityGrade` | Applied downward only; never upgrades or converts assertion into evidence (FR-015). |
| `channelKeys` | `{ data, method, institution, motive: string \| null }` | Identifiers used to detect shared contamination channels (FR-016); two lines share a channel when both carry the same non-null key for it. Added during implementation — required to make clustering computable, not spelled out separately above. |
| `finalGrade` | `WarrantGrade` | Computed: `startingGrade` after triggers, interested-party table, and reliability interaction. |

## Evidence Line

A surviving origin plus its grading, after normalization.

| Field | Type | Notes |
|---|---|---|
| `originId` | `string` | |
| `finalGrade` | `WarrantGrade` | Copied from `Warrant.finalGrade`. |
| `survives` | `boolean` | `false` when `finalGrade === 'assertion'` (zero-weight rule, FR-009) or the origin's line was removed by retraction (FR-010). |
| `diagnosticity` | `{ claim: DiagnosticMark; rivals: Record<string, DiagnosticMark> }` | One mark against the claim, one per live rival. |
| `nonDiagnostic` | `boolean` | `true` when consistent with the claim AND consistent with a live rival (FR-018) — excluded from cluster thresholds and warrant requirements but still reported. |
| `clusterId` | `string \| null` | Assigned during clustering; `null` only before clustering runs. |

## Cluster

A partition of evidence lines connected by shared contamination channels.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `memberLineIds` | `string[]` | Lines sharing any channel, directly or transitively (FR-016). |
| `sharedChannels` | `ContaminationChannel[]` | |
| `grade` | `WarrantGrade` | Best member's grade; internal cluster size adds nothing further (FR-017). |

## Rival

A competing explanation.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `description` | `string` | Carried through as data, never as instruction (Constitution V). |
| `rebutted` | `boolean` | `true` when some surviving line marks it `'inconsistent'` (FR-019). |
| `plausibilityRelativeToClaim` | `'more_plausible' \| 'less_or_equally_plausible'` | Distinguishes the two capping outcomes for an unrebutted rival named in Edge Cases. |

## LedgerInput

Top-level judgment-supplied schema for a single claim. This is the type `validate.ts` parses
external JSON against (research.md §1, §3) — it contains no field the engine itself computes.

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `string` | Versioned independently of engine/protocol version (FR-002, Constitution IV). |
| `claimRestatement` | `string` | Step 1 canonical restatement; identity for auto-linking (Constitution IV). |
| `classification` | `{ primary: ClaimType; confidence: 'high' \| 'low'; alternative?: ClaimType }` | `alternative` set only when `confidence === 'low'` and a second type is genuinely plausible (FR-030). |
| `screens` | `{ falsifiability: 'pass' \| 'fired'; priorPlausibility: 'ordinary' \| 'extraordinary' }` | `falsifiability: 'fired'` short-circuits to the Unfalsifiable verdict before any tree runs (FR-033). |
| `origins` | `Origin[]` | |
| `warrants` | `Warrant[]` | One per origin. |
| `rivals` | `Rival[]` | |
| `diagnosticityEntries` | `{ lineOriginId: string; against: 'claim' \| { rivalId: string }; mark: DiagnosticMark }[]` | Source data for each Evidence Line's `diagnosticity` field. |
| `adversarialStatus` | `AdversarialStatus` | |
| `silenceFinding` | `'none' \| 'weak' \| 'strong'` | |
| `steelman` | `{ performed: boolean; revisionOccurred: boolean }` | `revisionOccurred: true` is carried into the verdict trace per the Edge Cases entry on steelman-driven revision. |
| `extraordinaryClusterSurvivedAdversarialTesting` | `boolean \| null` | `null` unless `screens.priorPlausibility === 'extraordinary'`; when `true`, satisfies FR-031's requirement independently of `adversarialStatus`. |
| `treeExtension` | `Tree2Extension \| Tree3Extension \| Tree4Extension \| null` | Present only for the matching `classification.primary`. |

### Tree2Extension (causal)

`{ underlyingFactualBand: Band; temporalityFinding: 'established' \| 'absent'; discriminatingCriterionMet: boolean; supportiveCriteriaCount: number }`
— `temporalityFinding: 'absent'` disqualifies every band above `'doubtful'` (FR-026); a
discriminating criterion is an existence condition supportive criteria cannot satisfy at any count
(FR-027).

### Tree3Extension (predictive)

`{ /* same shape as Tree1's condition inputs */ meetsEstablishedShapedConditions: boolean }`
— Tree 3 is capped at `'probable'` regardless (FR-028).

### Tree4Extension (complex-system)

`{ decomposable: true; subClaimIds: string[] } | { decomposable: false; whyNoHonestBand: string; evidenceThatWouldChangeIt: string }`
— the irreducible branch feeds directly into the Unresolvable verdict's required explanation
(FR-029).

## CompoundInput

Separate entry point for aggregation (User Story 5); operates on sub-claim bands already computed
elsewhere, per spec Assumptions ("the claim graph is out of scope").

| Field | Type | Notes |
|---|---|---|
| `subClaims` | `{ id: string; band: Band; edgeType: 'load_bearing' \| 'supplementary' }[]` | |
| `edges` | `{ from: string; to: string }[]` | Used only for cycle detection; aggregation refuses on any cycle (FR-040). |

## Verdict

The engine's sole output shape, for both single-claim and compound evaluation.

| Field | Type | Notes |
|---|---|---|
| `band` | `Band` | |
| `qualifier` | `Qualifier \| null` | Non-null iff `band === 'contested'` (FR-022). |
| `tree` | `TreeId` | |
| `conditionsMet` | `{ id: string; protocolClause: string }[]` | Every id traces to a protocol clause (FR-046, SC-007). |
| `cappingConditions` | `{ id: string; protocolClause: string }[]` | Non-empty whenever `band` is below the tree's highest reachable band (FR-043). |
| `engineVersion` | `string` | (FR-045) |
| `schemaVersion` | `string` | (FR-045) |
| `dependenceMap` | `{ clusterId: string; channels: ContaminationChannel[]; memberLineIds: string[] }[] \| null` | Present for single-claim verdicts only (FR-020). |
| `residue` | `string \| null` | Set only for a decomposed complex-system claim with uncaptured residue (FR-029). |
| `movedBy` | `string \| null` | Set only on an aggregation recompute; names the sub-claim that changed the result (FR-039). |
| `refusalReason` | `string \| null` | Set instead of a band when the ledger is inconsistent or a required input is missing (FR-008); when non-null, all other fields except `engineVersion`/`schemaVersion` are `null`. |

## FixtureCase (test-only — not part of the production schema)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Referenced in every suite failure message (FR-050). |
| `protocolClause` | `string` | Which clause this case exercises (FR-047, SC-010). |
| `input` | `LedgerInput \| CompoundInput` | |
| `expected` | `{ band: Band; qualifier?: Qualifier; tree: TreeId }` | |

## State transitions

There is no persisted state in this feature (Storage: N/A) — every "transition" is a pure
computation within one call to `evaluate()`:

`LedgerInput` → (validate) → `Origin[]`/`Warrant[]` → (normalize) → `EvidenceLine[]` + `Cluster[]`
→ (tree matching `classification.primary`) → `Verdict`

`CompoundInput` → (cycle check) → (aggregate by minimum over load-bearing sub-claims, apply
supplementary demotion) → `Verdict`
