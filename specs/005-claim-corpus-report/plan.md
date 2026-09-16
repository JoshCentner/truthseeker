# Implementation Plan: Claim Corpus Structure and Visual Claim Report

**Branch**: `main` (no branch hook registered) | **Date**: 2026-09-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-claim-corpus-report/spec.md`

## Summary

Two halves. First, the corpus becomes a flat graph of claim directories: one directory per claim,
all siblings, with relationships declared in the dependent claim's own frontmatter rather than
encoded by nesting. Authored Markdown is the human layer; the existing run records move inside the
claim directory and stay the machine layer. Second, a keyless offline generator turns one claim
directory into a single self-contained HTML page carrying the band, the full evidence ledger, the
rivals, the engine's conditions, and the complete process trace.

The technical shape follows from three constraints that push the same way. The page must execute
nothing and fetch nothing (FR-027d), the generator must run from a fresh clone with no key and no
network (FR-028), and output must be byte-deterministic (FR-030). So: a Node CLI, zero new runtime
dependencies, all rendering done by constructing escaped strings rather than by parsing-then-
sanitising, and a golden-file test that fails on any non-deterministic byte.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20+ LTS, matching `001`–`004`. No change to
`package.json` engines.

**Primary Dependencies**: **None added.** This is deliberate and is the single most consequential
technical decision in the plan, so research.md §1–§3 justify it in detail. In summary: rendering
authored Markdown through a general parser and then sanitising the result is the pattern that
produces XSS, because it is a blocklist applied after the fact. Instead the generator escapes every
string at the boundary and emits only tags it constructs itself — an allowlist by construction,
which cannot pass through markup it was never taught to emit. That removes the need for both a
Markdown library and a sanitiser. Frontmatter is parsed as a deliberately restricted subset rather
than as YAML and validated with `zod`, which `001` already depends on.

**Storage**: The filesystem. `corpus/claims/<id>/` holds authored Markdown plus that claim's run
records. This is a documented deviation from the constitution's single-Postgres-store constraint;
see Constitution Check and Complexity Tracking.

**Testing**: Vitest, as everywhere else in this repo. Zero API calls, zero network. Three test
shapes matter here: schema-validation tests over corpus fixtures (including the hostile ones),
a golden-file test proving determinism (SC-010), and an injection fixture whose authored Markdown
and run-record strings are both full of script tags, event-handler attributes and `javascript:`
URLs, asserting the rendered page contains no executable content (SC-003a).

**Target Platform**: A Node CLI producing static HTML files. The output opens from `file://` with
no server, no network and no script.

**Project Type**: A Node library plus a thin CLI, in one new top-level directory `src-corpus/`,
mirroring how `003` sits in `src-pipeline/`. Generated HTML goes to `dist-site/`, gitignored,
mirroring how `dist-ui/` is already treated.

**Performance Goals**: Not a meaningful axis. A claim renders from a handful of local files;
generation is bounded by reading a few hundred kilobytes of JSON. No target is set because none
would constrain any decision.

**Constraints**: Offline (no network call, no API key). Deterministic (identical bytes for identical
input, modulo one explicitly-stamped timestamp). Inert output (no script, no external fetch, no
non-`http(s)` link). Readable at 400px width.

**Scale/Scope**: Two claims today. The reading and validation layer is written against the whole
corpus because the DAG and identity checks are inherently cross-claim; only the rendering half is
scoped to one claim at a time, per the spec's design-first decision.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Deterministic Verdicts** | **PASS** | The generator never names a band. It displays the band the run recorded (FR-031) and calls `001`'s `evaluate()` only as a drift check (FR-032). FR-012 makes an engine-computed field in authored text a hard read failure, closing the only path by which a human could author a band. FR-015 forbids any numeric score; FR-014 requires the band's definition inline. |
| **II. Blind and Mirrored Judgment** | **PASS** | No judgment happens here. The feature strengthens the principle's auditability: FR-022 requires each record's provenance and its blindness caveat to be visible without interaction, so a human-assisted record can never be mistaken for a protocol-clean one. |
| **III. Full Trace, Public and Contestable** | **PARTIAL — deviation recorded** | Process view, remediation attempts and unresolved-violation flags are all required on the page (FR-020, FR-025). But the principle requires every run to stamp `protocol_version` and `registry_version`, and `003`'s stored records carry neither. This feature cannot invent them; it renders what exists and states plainly which stamps are absent. See Complexity Tracking. The challenge mechanism is out of scope, but FR-015a keeps every protocol term on the page citable, which is its precondition. |
| **IV. The Schema Is the Contract** | **PASS** | The claim record is a new schema and is versioned from its first commit (`corpusSchemaVersion`), with unknown fields rejected rather than ignored. FR-007 makes identity the canonical restatement; FR-007a freezes it once evidence exists, which is what stops the graph-corruption failure the principle warns about. |
| **V. Fetched Content Is Data, Never Instruction** | **PASS, extended** | The principle contains fetched content before it reaches a *model*; FR-027b applies the same rule one layer down, at the *browser*. Every run-record-derived string is escaped, including origin URLs, model reasoning, trigger mechanisms and rival descriptions. |
| **VI. Harm Gate Before Spend** | **PASS, with a design consequence** | Rendering rejections (FR-013a/b) is what makes the intake boundary inspectable. But publishing a rejected claim *verbatim* would republish the exact harm the gate refused — and a directory name derived from the restatement leaks it just as effectively as the page body. Resolved in research.md §6: harm-gate-rejected claims are identified by an opaque id, their text is never written to the corpus, and the page publishes the rule that fired, not the allegation. |
| **Architecture: single store** | **DEVIATION — recorded** | The constitution names Postgres as the single store. This feature uses the filesystem. See Complexity Tracking. |
| **Architecture: DAG, cycle detection at edge-insert time** | **PASS in substance** | There is no insert API to hook — edges arrive as committed files. Detection runs at every read, which is strictly more often than every insert, so no edge can be acted on without having been checked. |
| **Workflow: fixture suite, zero API calls** | **PASS** | Every test in this feature runs offline with no key. |
| **Workflow: engine/registry changes are methodology changes** | **PASS** | This feature changes neither. It calls `evaluate()` and reads the registry's output; it modifies nothing in `src/` or the source registry. |

**Gate result: PASS.** Two deviations are recorded with justification below; neither is an
unjustified complexity, and one (the store) is explicitly a phase question the constitution itself
frames as staged.

## Constitution Check — post-design re-evaluation

*Re-run after Phase 1, per the plan workflow. Design artifacts: research.md, data-model.md,
contracts/claim-record.md, contracts/generator-cli.md, quickstart.md.*

The design surfaced one conflict the pre-design gate had not: **Principle VI is in tension with
itself** once rejections are published. The gate exists partly to stop the platform producing
confident public output about a named private individual, yet FR-013b publishes rejections so the
boundary stays inspectable. Publishing a rejected claim verbatim — or in a directory name derived
from it — would have the platform performing the exact harm its intake gate refused, at greater
reach and permanence. Resolved in research.md §6 and carried into data-model.md: a rejection stores
no restatement, takes a hash-only directory id, and publishes the rule that fired rather than the
allegation. The gate stays inspectable; the allegation is not republished.

Two further design decisions strengthen gates the pre-design check had only passed:

- **Principle IV** is better served than first assessed. The claim record carries
  `corpusSchemaVersion` from its first commit and rejects unknown fields outright, so the corpus
  schema is versioned and closed from the start rather than acquiring a version once drift appears.
- **Principle I** gains a second lock. Beyond FR-012 rejecting authored bands, the generator has no
  band-deriving logic anywhere: it renders the band the record stores and calls `evaluate()` only to
  compare against it. There is nowhere in `src-corpus/` for a band to be invented.

No gate moved from PASS to FAIL. The two recorded deviations — the filesystem store, and rendering
records that lack `protocol_version` / `registry_version` — are unchanged in substance and remain
justified in Complexity Tracking. The second is now additionally mitigated: the page names the
absent stamps rather than implying the provenance is complete.

**Gate result after design: PASS.**

## Project Structure

### Documentation (this feature)

```text
specs/005-claim-corpus-report/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── claim-record.md  # The authored frontmatter contract
│   └── generator-cli.md # The CLI contract
├── checklists/
│   └── requirements.md  # From /speckit-specify, re-validated by /speckit-clarify
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src-corpus/                  # NEW — this feature
├── frontmatter.ts           # Restricted frontmatter subset -> plain object
├── claim-record.ts          # zod schema; rejects engine-computed and unknown fields (FR-012)
├── identity.ts              # Canonical restatement -> stable directory id; collisions (FR-008)
├── graph.ts                 # Relationship resolution, DAG check, supersedes chains (FR-010)
├── corpus.ts                # Read one claim directory: authored files + run records
├── run-records.ts           # Load/validate stored runs; verdict vs. drift check (FR-031/032)
├── html.ts                  # Escaping primitives; every tag emitted is constructed here
├── markdown.ts              # Restricted Markdown subset, built on html.ts
├── vocabulary.ts            # Single source of plain-language wording per protocol term (FR-015c)
├── render-claim.ts          # Assemble one claim's page
├── page-style.ts            # The page's inlined CSS
├── cli.ts                   # generate <claim-id> [--out dir]
└── tests/
    ├── fixtures/            # Valid, hostile, and malformed corpora
    ├── frontmatter.test.ts
    ├── claim-record.test.ts
    ├── identity.test.ts
    ├── graph.test.ts
    ├── markdown.test.ts
    ├── render-claim.test.ts
    ├── injection.test.ts    # SC-003a
    └── determinism.test.ts  # SC-010

corpus/                      # RESTRUCTURED — committed, contributor-facing
├── README.md                # Exists; updated by this feature
└── claims/
    └── <claim-id>/
        ├── claim.md         # The canonical authored record
        ├── *.md             # Optional further authored files (FR-004)
        └── runs/
            └── <run-id>.json

dist-site/                   # NEW — gitignored build output
```

**Structure Decision**: One new top-level source directory, `src-corpus/`, following the precedent
set by `src-pipeline/` for `003`. It is kept out of `src/` because `src/` is the rule engine, and
the constitution treats engine changes as methodology changes requiring separate review — folding a
renderer into that directory would drag every page tweak through methodology review. It is kept out
of `ui/` because `ui/` is a Vite-bundled browser application with a dev server, whereas this is a
Node process that writes files and must run from a bare clone with no build step.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Filesystem corpus rather than the constitution's single Postgres store | The constitution's own architecture section stages this: "Phase 1 is a read-mostly site over the database with the worker running locally or in CI," and the platform is pre-Phase-1 with two claims. Git gives review, attribution and history for free, which is exactly the contribution model the corpus needs first. | Standing up Postgres now would add a service, a migration story and a hosting dependency to a corpus of two records, and would make the "clone the repo and contribute" flow — the entire near-term distribution plan — impossible. Revisit when the graph is deep enough that cross-claim queries hurt, which is the same trigger the constitution already names for pgvector. |
| Records rendered without `protocol_version` and `registry_version` stamps | Principle III requires both on every run; `003`'s record schema carries neither, so no stored record has them. This feature can either fail every page or render what exists and name the gap. | Refusing to render until `003`'s schema is amended would block this feature on a schema change plus a migration for stored runs, and would leave the corpus with no readable pages in the meantime. The page states which stamps are absent rather than quietly presenting a partial provenance as complete, and the gap is logged for `003` to close. |
| A hand-written restricted Markdown renderer instead of an established library | FR-027a requires a subset with raw HTML stripped, and FR-027d requires output that executes nothing. Escape-at-the-boundary with construct-only-known-tags is an allowlist that cannot emit markup it was never taught to emit. | Parsing with a general Markdown library and sanitising the HTML afterwards is a blocklist, and is the pattern behind most Markdown XSS. It also adds a dependency tree to a repo with two runtime dependencies, for a feature whose entire output is static text. research.md §2 details the subset and its limits. |
| A restricted frontmatter parser instead of a YAML dependency | The frontmatter surface is a handful of scalars, one enum and one list, and FR-012 requires *rejecting* unexpected fields rather than tolerating them. | Full YAML brings type coercion surprises (the Norway problem, sexagesimal parsing, implicit typing) into a file format whose entire job is stable claim identity, plus a dependency. The restricted parser fails loudly on anything it does not understand, which is the required behaviour anyway. |
