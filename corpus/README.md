# Corpus

Completed, human-inspectable run records. One JSON file per run, each holding the full
`PipelineResult`, the `Verdict` that `001`'s `evaluate()` computed from its ledger, and a
`provenance` block.

Unlike `runs/` (gitignored, append-only operational logs) this directory is committed, so records
can be contributed by anyone who clones the repo and opened as a pull request.

## Read the provenance block before trusting a record

Records produced via `tools/manual-run/` carry a `blindnessCaveat`. They are **not**
protocol-clean runs. In a real run each step is its own API call, so `gradeOrigin()` is
structurally incapable of seeing the claim or the ledger — that is Constitution Principle II's
guarantee, and it is enforced by the function signature. When a person or an assistant fills in a
transcript by hand, every step is answered from one context that has seen everything. Blindness
there is a discipline, not an architectural property. Treat those records as worked examples and
as fixtures, not as evidence that the protocol's mirror rule held.

## Known engine defects affecting stored bands

Bands in records produced before the items dated 2026-09-15 in `PROJECT-TRACKER.md` are resolved
should be read with those defects in mind — in particular that `001`'s Tree 1 counts lines marked
`inconsistent` with a claim toward that claim's corroboration, and that every causal claim's band
is currently a constant. Both are reproducible via `tools/manual-run/probes/`.
