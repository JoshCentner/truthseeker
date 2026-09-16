# Contract: the claim record

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

This is the file a contributor writes by hand. It is the only authored surface in the corpus, so the
rules are strict and every violation is a loud failure rather than a silent correction.

## File

`corpus/claims/<claim-id>/claim.md` — exactly one per claim directory.

## Frontmatter format

Delimited by `---` on its own line, at the very start of the file. The format is a **restricted
subset**, not YAML (research.md §3). Three forms only:

```markdown
---
corpusSchemaVersion: 0.1.0
claimKind: claim
canonicalRestatement: |
  The Great Wall of China is visible from space with the naked eye.
parentClaim: some-other-claim-a1b2c3d4
edgeType: load_bearing
aliases:
  - Can you see the Great Wall from orbit
  - Great Wall visible from the Moon
---

Free prose below the frontmatter. Rendered as a restricted Markdown subset.
```

- `key: value` — a scalar. The value is taken as a literal string, trimmed. It is never coerced to a
  number, boolean or date.
- `key: |` followed by indented lines — a block scalar, for multi-line values. Preferred for
  `canonicalRestatement` so punctuation and leading characters can never be mistaken for syntax.
- `key:` followed by indented `- item` lines — a list of literal strings.

Anything else — nested maps, inline `[a, b]` arrays, anchors, tags, comments, quoted keys — is an
error naming the file and the line. The parser does not guess.

## Fields

See [../data-model.md](../data-model.md) for the full table. Summary of what is enforced:

| Rule | Failure |
|---|---|
| `corpusSchemaVersion` present and known | Error naming file and the versions this build accepts |
| `claimKind: claim` ⇒ `canonicalRestatement` present | Error naming file |
| `claimKind: rejection` ⇒ `canonicalRestatement` absent | Error; a rejection must not republish the claim (research.md §6) |
| `parentClaim` present ⟺ `edgeType` present | Error naming whichever is missing |
| `edgeType` ∈ {`load_bearing`, `supplementary`} | Error listing permitted values |
| `supersedes` present ⇒ `supersedesConfirmedBy` present | Error; non-identical linking is never automatic |
| Referenced claim ids exist | Error naming the missing claim (FR-011) |
| Edges form a DAG | Error naming every claim in the cycle (FR-010) |
| Directory name equals id derived from `canonicalRestatement` | Error showing both; this is what enforces immutability (FR-007a) |
| Every run record's claim text equals `canonicalRestatement` | Error naming the run (FR-007d) |
| No engine-computed field present | Error naming file and field (FR-012) |
| No unknown field present | Error naming file and field |

**Engine-computed fields are rejected, not ignored.** Writing `band: established` into a claim record
fails the read. It does not render, and it does not silently do nothing — a contributor who typed it
is told why it cannot work, because a field that appears to be accepted and has no effect is worse
than one that errors.

## Body

Rendered as the restricted Markdown subset: headings (levels 2–4), paragraphs, emphasis, strong
emphasis, ordered and unordered lists, inline code, fenced code blocks, block quotes, inline links.

- Raw HTML is **stripped**, not escaped-and-displayed and not passed through (FR-027a).
- Links render as clickable only for `http` and `https`. Any other scheme renders as inert text
  (FR-027c).
- Any construct outside the subset renders as literal text, so a contributor sees that it did not
  take effect rather than finding their content silently dropped.

## Claim identity

The claim id — which is the directory name — is derived from `canonicalRestatement`:

1. Lowercase; replace each run of non-alphanumeric characters with a single hyphen; trim hyphens.
2. Truncate the readable part to 48 characters at a hyphen boundary.
3. Append a hyphen and the first 8 hex characters of the SHA-256 of the **full, untruncated,
   untransformed** restatement.

So byte-identical restatements always produce the same id and therefore auto-link (FR-007), and
distinct restatements cannot collide. A restatement that is long, non-Latin, or entirely punctuation
degrades to a short or empty readable part plus the hash, which still identifies it exactly.

Harm-gate rejections have no restatement, so they take `rejected-` plus 16 hex characters derived
from the run id (research.md §6).

## Worked example

```markdown
---
corpusSchemaVersion: 0.1.0
claimKind: claim
canonicalRestatement: |
  The Great Wall of China is visible from space with the naked eye.
---

## Why this claim was recorded

A long-lived popular belief with abundant published evidence on both sides, which makes it a
useful first test of whether the pipeline's sourcing and grading behave sensibly.

## Notes

The strongest counter-evidence is an optics calculation rather than an observation, which is
worth keeping in mind when reading the warrant grades.
```
