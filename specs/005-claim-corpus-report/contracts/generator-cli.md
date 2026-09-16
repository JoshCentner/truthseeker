# Contract: the report generator CLI

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

## Invocation

```bash
node --import tsx src-corpus/cli.ts <claim-id> [--out <dir>] [--corpus <dir>] [--check]
```

| Argument | Default | Meaning |
|---|---|---|
| `<claim-id>` | required | The claim directory name under the corpus's `claims/`. |
| `--out` | `dist-site` | Directory the page is written to. Created if absent. |
| `--corpus` | `corpus` | Corpus root. Exists so tests can point at fixture corpora. |
| `--check` | off | Validate and report without writing any file. |

Writes `<out>/claims/<claim-id>.html`, one self-contained file.

## Guarantees

- **No network.** The generator makes no outbound request, and the page it produces makes none when
  opened. No API key is read from anywhere (FR-028).
- **Deterministic.** Two runs over an unchanged corpus produce byte-identical output except for one
  line carrying the generation timestamp (FR-030).
- **Inert output.** No `<script>`, no event-handler attributes, no external resource references, no
  clickable non-`http(s)` URL (FR-027c/d).
- **Whole-corpus validation, single-claim rendering.** Identity, relationship and DAG checks are
  cross-claim by nature and always run across the whole corpus; only rendering is scoped to the
  named claim.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Page generated (or, with `--check`, validation passed) |
| 1 | Claim id not found in the corpus |
| 2 | Corpus validation failed — schema, identity, missing reference, cycle, or forbidden field |
| 3 | The claim exists but holds no run record; nothing to render |
| 4 | Usage error |

Every non-zero exit prints what failed, which file it is in, and — for cycles and identity
mismatches — every participant, not just the first one found.

## Output structure

One HTML file, in this order. The order is itself a requirement: Principle III makes the process
view a launch requirement rather than an appendix, so it sits in the document above the glossary and
is never collapsed behind an interaction.

1. **Claim** — the canonical restatement, claim id, and any aliases.
2. **Verdict** — the recorded band with its definition inline (FR-014), the engine version that
   produced it, and, where the current engine disagrees, both bands marked as drift (FR-032).
3. **Stability record** — beside the verdict, every run with date, engine version and band, plus any
   disagreement among runs sharing an evidence base (FR-029/029a).
4. **Provenance** — run id, requester, model ids, engine and schema versions, timestamps, the
   record's provenance block including any blindness caveat, and an explicit note of which
   constitutionally-required stamps the record does not carry (research.md §7).
5. **Relationships** — parent, sub-claims and supersedes links, each with its edge type (FR-023).
6. **Evidence ledger** — every origin with URL, retrieval status, warrant grade, reliability grade
   and fired triggers with their mechanisms; grouped into supporting, opposing and neither, per the
   line's diagnosticity mark (FR-016/FR-017/FR-027).
7. **Rivals** — description, rebutted state, plausibility relative to the claim (FR-018).
8. **Engine conditions** — conditions met and conditions capping, each with its recorded clause
   (FR-019).
9. **Process trace** — steps in order, sources pulled, and every remediation attempt including
   failures with the violation each reported (FR-020).
10. **Authored notes** — the claim record's prose and any supplementary files, clearly marked as
    authored rather than generated (FR-013).
11. **Glossary** — every protocol term appearing on the page (FR-015b).

For a run without a verdict, sections 2, 3, 6, 7, 8 are replaced by a single outcome section stating
what happened and why (FR-013a). For a harm-gate rejection the page carries the rule that fired and
nothing of the claim itself (research.md §6).

## What the generator must never do

- Name a band. It displays what the engine computed; it has no band logic of its own (Principle I).
- Display a numeric score, percentage or confidence value (FR-015).
- Omit an origin because retrieval failed (FR-027).
- Omit a remediation attempt because it failed (FR-020).
- Present a partial provenance as if it were complete (research.md §7).
- Render a harm-gate-rejected claim's text (research.md §6).
