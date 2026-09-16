# Corpus

The committed claim graph. Every claim is a directory under `claims/`, and every claim directory is
a **sibling** of every other one — including sub-claims. The filesystem never encodes the graph.

```text
corpus/claims/<claim-id>/
├── claim.md            # the canonical authored record (exactly one)
├── *.md                # optional further authored files: notes, challenges, correspondence
└── runs/
    └── <run-id>.json   # the machine-readable record of one pipeline run
```

A sub-claim declares its relationship in its **own** frontmatter, pointing up at its primary claim:

```markdown
parentClaim: the-primary-claims-id-a1b2c3d4
edgeType: load_bearing        # or: supplementary
```

Full field reference and the frontmatter rules:
[`specs/005-claim-corpus-report/contracts/claim-record.md`](../specs/005-claim-corpus-report/contracts/claim-record.md).

## Authored versus generated

`claim.md` and any sibling `*.md` are **authored** — you write them, and they are what a pull request
reviews. Everything under `runs/` is **generated** by a pipeline run and should not be hand-edited.

**A band is never authorable.** Writing `band: established` — or `verdict`, `tree`, `engineVersion`,
or any other engine-computed field — into a claim's frontmatter does not set a band. It fails the
read, naming the file and the field. This is deliberate: Constitution Principle I requires the band
to be computed by code from a populated schema, and that guarantee survives only if a hand-written
band is refused out loud rather than quietly ignored. A field that appears to be accepted and has no
effect is worse than one that errors.

Identity works the same way. A claim's directory name is derived from its canonical restatement, so
**editing a restatement after a run exists fails the read**. A reworded claim is a new claim
directory naming the old one in `supersedes`. That is more friction than editing a line, on purpose:
the alternative is evidence silently answering a different question than the one displayed.

## Reading a record

Generate the page:

```bash
node --import tsx src-corpus/cli.ts <claim-id>
```

It needs no API key and makes no network request, so anyone who clones the repository can regenerate
any page. Output lands in `dist-site/`, which is gitignored — the corpus is the thing under version
control, not the rendering of it.

## Read the provenance before trusting a record

Records produced via `tools/manual-run/` carry a `blindnessCaveat`. They are **not** protocol-clean
runs. In a real run each step is its own API call, so `gradeOrigin()` is structurally incapable of
seeing the claim or the ledger — that is Constitution Principle II's guarantee, enforced by the
function signature. When a person or an assistant fills in a transcript by hand, every step is
answered from one context that has seen everything. Blindness there is a discipline, not an
architectural property. Treat those records as worked examples and fixtures, not as evidence that
the protocol's mirror rule held. The generated report states this on the page; do not strip it.

## Bands move when the engine moves

A report shows the band its run **recorded**, stamped with the engine version that produced it, and
separately shows what today's engine computes from the same ledger. When those differ the record is
marked superseded and both are displayed. This is not hypothetical: an engine change on 2026-09-15
moved an existing record from Contested to Refuted off an unchanged ledger.

## Aggregators are refused, not graded

A source whose domain is classed `aggregator` in the structural registry — news aggregators, and
tertiary reference works like Wikipedia or Britannica — is refused before it can become an origin.
This is a deterministic check in code, not an instruction to a model.

The reason is not that such sources are unreliable. It is that an aggregator is a *pointer* to
evidence, not evidence: admitting one lets it occupy a cluster and count toward corroboration,
double-counting whatever original source it summarises and inflating how independent the evidence
base looks. Cite the original instead.

Refusals are never silent. Every excluded source is recorded on the run trace and shown on the
report under “Which sources were allowed to count”. Where a record predates a registry addition, the
page says so rather than the record being edited or withdrawn.

## Known limitations

See `PROJECT-TRACKER.md`. The two that most affect how a record should be read:

- **Causal, predictive and complex-system claims do not yet consult their evidence.** Trees 2–4
  return a fixed conservative band from the claim's type alone. A `contested` band on a causal claim
  means "this system does not yet judge causal claims", not a finding about the claim.
- **Two constitutionally-required stamps are missing** from every stored run: `protocol_version` and
  `registry_version`. Reports name the absence rather than implying the provenance is complete.
