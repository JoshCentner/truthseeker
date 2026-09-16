# Data Model: Claim Corpus Structure and Visual Claim Report

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Contract**: [contracts/claim-record.md](./contracts/claim-record.md)

## On-disk shape

```text
corpus/
├── README.md
└── claims/
    ├── great-wall-of-china-is-visible-from-space-a1b2c3d4/
    │   ├── claim.md                     # canonical authored record (exactly one)
    │   ├── notes.md                     # optional further authored files
    │   └── runs/
    │       └── <run-id>.json            # one or more run records
    ├── vaccines-cause-autism-e5f6a7b8/
    │   └── ...
    └── rejected-9c8d7e6f5a4b3c2d/       # a harm-gate rejection: hash only, no restatement
        └── runs/
            └── <run-id>.json
```

Every claim directory is a sibling. Nesting is not a supported way to express any relationship, and
a claim directory containing another claim directory is a read error (FR-002).

## Entities

### ClaimRecord

The authored layer. Lives in `claim.md`, one per claim directory. Frontmatter carries structured
fields; the Markdown body carries free prose which is rendered but never interpreted.

| Field | Type | Required | Notes |
|---|---|---|---|
| `corpusSchemaVersion` | string | yes | Semver. Frozen early, extended by version bump; Principle IV. |
| `canonicalRestatement` | string | yes, except rejections | The claim's identity (FR-007). Immutable once a run exists (FR-007a). Absent for harm-gate rejections (research.md §6). |
| `claimKind` | `"claim"` \| `"rejection"` | yes | A rejection carries no restatement and no band, and renders under different rules (FR-013a/b). |
| `parentClaim` | claim id | no | Present on a sub-claim. Names a sibling directory. |
| `edgeType` | `"load_bearing"` \| `"supplementary"` | required iff `parentClaim` | Constitution's vocabulary (FR-006). |
| `supersedes` | claim id | no | Set on a reworded claim (FR-007b). Distinct relation from `parentClaim`; not a sub-claim edge. |
| `supersedesConfirmedBy` | string | required iff `supersedes` | Names the human who confirmed the link. Non-byte-identical linking cannot be automatic (FR-007b). |
| `aliases` | string[] | no | Alternative wordings. Do **not** affect identity; open to requesters per the constitution. |

**Forbidden fields.** `band`, `qualifier`, `verdict`, `tree`, `conditionsMet`, `cappingConditions`,
`engineVersion`, `schemaVersion` and any other engine-computed name are rejected outright with the
file and field named (FR-012). Unknown fields are also rejected — silently ignoring them would let a
contributor believe a typo'd key had taken effect.

**Validation rules**

1. `claimKind: "claim"` requires `canonicalRestatement`; `claimKind: "rejection"` forbids it.
2. `edgeType` present iff `parentClaim` present. Either alone is an error.
3. `parentClaim`, `supersedes` must resolve to existing claim directories (FR-011).
4. The directory name must equal the id derived from `canonicalRestatement` (FR-008, research.md §5).
5. Once `runs/` is non-empty, `canonicalRestatement` is immutable (FR-007a), enforced by rule 4
   plus rule 6 — a changed restatement yields a different derived id than the directory it sits in.
6. Every run record's stored claim text must equal `canonicalRestatement` (FR-007d).

### SupplementaryFile

Any other `*.md` in a claim directory. Rendered as authored prose in document order by filename.
Carries no frontmatter fields that affect identity, relationships or verdict; if it declares any
structured field at all, that is an error rather than a silent no-op.

### Relationship

Not a stored entity — derived by reading every claim record's `parentClaim` and `supersedes`.

| Property | Value |
|---|---|
| Direction | Declared on the dependent claim, pointing at the claim it depends on. |
| Types | `load_bearing`, `supplementary` (sub-claim edges); `supersedes` (version edge). |
| Constraint | The union of all edges must form a DAG. A cycle fails the read naming every participant (FR-010). |
| Self-reference | A claim naming itself is a cycle of length one and fails the same way. |

### RunRecord

Unchanged from what `tools/manual-run` and the pipeline already write; this feature only relocates
it into the claim directory and reads it. Two shapes:

**With a verdict** (`result.kind === "completed"`): carries `result.ledger`, `result.trace`,
`verdict`, `provenance`.

**Without a verdict** (`result.kind` is `rejected`, `needs_review` or `needs_clarification`):
carries the outcome and its reason — the rule that fired, the queue reason, or the step that
exhausted its attempts together with the questions it raised. No ledger, no band (FR-009a).

`result.kind === "auth_failed"` is **not** storable in the corpus (FR-009b).

### DisplayedVerdict

Derived at generation time, never stored.

| Property | Source |
|---|---|
| `recordedBand` | The run record's own `verdict.band` (FR-031). |
| `recordedEngineVersion` | The run record's `verdict.engineVersion`. |
| `currentBand` | `evaluate(ledger).band` under the engine present at generation time (FR-032). |
| `currentEngineVersion` | The engine constant at generation time. |
| `drift` | `"none"` \| `"superseded"` \| `"uncheckable"`. `superseded` when the two bands differ; `uncheckable` when the record's schema version cannot be read (FR-033). |

### StabilityRecord

Derived. One row per run against the claim, ordered newest first, each carrying date, engine
version, band and evidence-base fingerprint. Rendered beside the band, not below it (FR-029).

**Evidence-base fingerprint** (FR-029b): the sorted set of `(originId, retrievalStatus, retracted)`
triples from the run's ledger. Two runs share an evidence base when their fingerprints are equal.
Known limitation, carried from the spec's Assumptions: content hashes live in the fetch archive
rather than in the record, so a source that silently changed at the same URL reads as unchanged.

**Disagreement** (FR-029a): when any run sharing the displayed run's fingerprint recorded a
different band, that disagreement is surfaced at the band itself.

### VocabularyTerm

The single source of plain-language wording (FR-015c). Keyed by protocol term; every term rendered
anywhere on a page must have an entry, and a missing entry is a generation error rather than a
silent fallback to the raw identifier.

| Field | Notes |
|---|---|
| `term` | The exact protocol string, e.g. `physical_documentary`, `T1-REFUTED-COUNTER`. |
| `plain` | Short plain-language rendering shown first, e.g. "Instrument or documentary record". |
| `definition` | One or two sentences for the glossary (FR-015b). |

Bands additionally require their definition inline at the band itself, not only in the glossary
(FR-014).

## State transitions

A claim has exactly one lifecycle, and it is deliberately short.

```text
                 (no runs yet)
   [ drafted ] ─────────────────────► restatement still editable
        │
        │ first run record committed
        ▼
   [ evidenced ] ───────────────────► restatement frozen (FR-007a)
        │
        │ a reworded claim is committed naming this one in `supersedes`
        ▼
   [ superseded ] ──────────────────► stays published, evidence and verdict intact,
                                      links forward to its replacement (FR-007c)
```

There is no `deleted` and no `withdrawn`. A superseded claim remains readable because citations
already made against it must not break; withdrawal would be the corpus rewriting its own history,
which is what Principle III's stability and challenge records exist to prevent.
