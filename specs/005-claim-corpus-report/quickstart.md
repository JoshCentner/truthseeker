# Quickstart: Claim Corpus Structure and Visual Claim Report

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/generator-cli.md](./contracts/generator-cli.md), [contracts/claim-record.md](./contracts/claim-record.md)

Unlike `003`'s quickstart, everything here is validatable offline with no API key. That is the
point of the feature, not a convenience: the whole contribution model depends on someone being able
to clone the repo and regenerate the site without credentials.

## Part 1: automated validation

```bash
npm install
npm test
```

**Expected**: all `src-corpus/tests/*.test.ts` pass alongside the existing suites. This proves:

- A claim record declaring an engine-computed field fails the read, naming the file and field
  (SC-006) — the guarantee that keeps Principle I intact against hand-editing.
- A relationship cycle fails the read naming every participant, not just the first (SC-007).
- Altering a restatement on a claim that already holds a run fails the read (SC-007a).
- A hostile fixture — authored Markdown and run-record strings both stuffed with script tags,
  event-handler attributes and `javascript:` URLs — renders a page containing no executable content
  and no clickable non-`http(s)` link (SC-003a).
- Rendering the same fixture corpus twice produces byte-identical output apart from the single
  stamped generation timestamp (SC-010).
- Every protocol term rendered on a page has a glossary entry; a term without one is a generation
  error rather than a bare identifier on the page (SC-001c).

## Part 2: generate the real page

```bash
node --import tsx src-corpus/cli.ts great-wall-of-china-is-visible-from-space-<hash>
```

The exact id is printed by `ls corpus/claims`. Then open `dist-site/claims/<id>.html` in a browser —
straight from disk, no server.

**Check by hand.** These are the things a test cannot judge:

- **Does it read?** Give it to someone who has never seen the project. Can they state the band, what
  it means, one source it rests on, and one thing argued against it, in two minutes without asking
  you a question (SC-001)? If they cannot, the page has failed its primary job no matter what the
  test suite says.
- **Can they explain the weighting?** Ask why one piece of evidence counted for more than another
  (SC-001b). This is where plain-language rendering either works or is revealed as decoration over
  jargon.
- **Is the process view actually usable**, or merely present? Principle III requires it as a launch
  requirement. A trace nobody can follow satisfies the letter and fails the intent.
- **Is the blindness caveat impossible to miss** (SC-005)? The Great Wall record was produced with a
  human answering every step. A reader who comes away thinking it was a clean automated run has been
  misled by the page.
- **Is the drift disclosure legible?** Verify with `git stash` on the engine bump if you want to see
  it: a record produced at engine 0.1.0 shows `contested`, while the current engine computes
  `refuted` from the same ledger. Both must be on the page, both labelled.

## Part 3: verify the offline guarantee

```bash
# Kill networking, then:
node --import tsx src-corpus/cli.ts <claim-id> --out /tmp/offline-check
```

**Expected**: identical output to the online run (SC-009). If this fails, something is reaching the
network that must not be.

Also confirm the page itself is inert — open it with devtools' network tab recording and reload.
Zero requests. A page that fetches a font or an analytics script is a page that tells someone else
who is reading which claim.

## Part 4: add a sub-claim

This exercises the graph half of the feature end to end.

1. Create `corpus/claims/<new-id>/claim.md` following
   [contracts/claim-record.md](./contracts/claim-record.md), with `parentClaim` naming an existing
   claim and `edgeType: load_bearing`.
2. Run the generator against both claims.

**Expected**: the sub-claim sits as a sibling directory, never inside its parent (FR-001/002); each
page links to the other with the edge type stated (SC-008).

**Then break it on purpose** — point `parentClaim` at a claim that does not exist, and separately
make two claims name each other. Both must fail the read with a specific message naming the missing
claim or every participant in the cycle. A corpus that silently drops a broken edge is worse than
one that refuses to build.

## Troubleshooting

- **"Claim id does not match its restatement"**: the restatement was edited after a run was
  recorded. This is FR-007a working as designed, not a bug. A reworded claim is a new claim
  directory with `supersedes` pointing at the old one — deliberately more friction than editing a
  line, because the alternative is evidence quietly answering a different question.
- **"No glossary entry for term X"**: a protocol term reached the page with no plain-language
  wording defined. Add it to `vocabulary.ts`. The generator refuses to print a bare identifier
  because SC-001c requires every displayed term to be defined on the same page.
- **A Markdown construct rendered as literal text**: expected for anything outside the supported
  subset (tables, images, footnotes, raw HTML). It renders visibly rather than disappearing so the
  contributor can see it did not work — see contracts/claim-record.md for the supported list.
- **The page has no band**: check whether the run ended without a verdict. A rejection, a review
  hold or an exhausted remediation renders its outcome instead of a band, which is correct
  behaviour (FR-013a), not a missing verdict.
