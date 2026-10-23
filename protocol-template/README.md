# Protocol template

Fill-in files for one run of `AGENT-PROTOCOL-v3.md`. Two file types, both flat:

```text
<case>/
├── claims/<claim-id>.md     # one per claim at ANY depth: top claim, sub-claim, sub-sub-claim
└── origins/<origin-id>.md   # one per evidence origin, shared by every claim that cites it
```

## Rules

1. **The graph is stored upward only.** A claim lists what it `needs` and what it `cites`. Nobody ever
   writes "who depends on me". The tool derives that, so it cannot drift.
2. **A sub-claim is just a claim.** Same template at every level. Two parents can `need` the same
   sub-claim; it is written and graded once. This is a DAG, not a tree.
3. **Edge roles** (on each `needs` line, after the pipe): `load_bearing`, `supplementary` (Aggregation
   section of the protocol), `prerequisite` (Tree 2: underlying factual claim must reach Probable+).
4. **Bands are never written.** They are computed from the filled files by the existing engine.
5. **Claim-independent vs claim-relative.** Provenance, warrant, D1/D2/D4 and reliability are facts
   about the origin: they go in the origin file. D3 indirectness, interested-party status and the
   diagnostic marks depend on which claim the origin is being used for: they go in the claim's ledger.

## Staleness (to be built, not authored)

Change an origin or a sub-claim and every claim above it must be re-evaluated. The tool should hash
each file's inputs, store the hashes in a generated file next to the case, and mark any claim whose
inputs changed as stale, all the way up the chain. Never hand-edit that file.

## Frontmatter

Same restricted subset as `corpus/` (scalars, `|` block scalars, lists of literal strings; no
comments, no nesting), so these files can be read by the same parser.
