---
templateVersion: 0.1.0
claimKind: claim
canonicalRestatement: |
  <the claim in its most precise, testable form - one sentence if possible>
type: <simple_factual | causal | predictive | complex_system>
classificationConfidence: <high | medium | low>
alsoPlausibleType: <none | simple_factual | causal | predictive | complex_system>
extraordinary: <yes | no>
falsifiable: <yes | no>
needs:
  - <claim-id> | <load_bearing | supplementary | prerequisite>
cites:
  - <origin-id>
---

<!--
FILL-IN RULES
- One file per claim, at any depth. File name = <claim-id>.md. Put it in claims/.
- `needs` points DOWN at sub-claims. Never write who depends on this claim; the tool derives that.
- `cites` lists every origin this claim uses, supporting or opposing. Origins live in origins/.
- Never write a band. It is computed from this file + the origins + the needed claims.
- A claim with `needs` and no `cites` is a pure compound. A claim with `cites` and no `needs` is a leaf.
- Delete this comment block and any section that truly does not apply, but write "n/a: <why>" rather than leaving it blank.
-->

## 1. Restatement and decomposition

**Ambiguity noted / reading chosen:** <...>

**Falsifiability screen:** <what observation could show this false?>

**Prior-plausibility screen:** <contradicts settled background knowledge? If yes, EXTRAORDINARY - say what it contradicts>

**Decomposition:** <why each `needs` entry exists, and why it is load_bearing / supplementary / prerequisite>

## 2. Classification

**Order checked:** causal? -> predictive? -> complex-system? -> simple factual.
**Result and why:** <...>
**If two types plausible:** <both trees' results; report the lower band>

## 3. Evidence ledger

Claim-relative judgments only. Origin-intrinsic facts (provenance, warrant, D1/D2/D4, reliability) live in the origin file.

| Origin | Direction | D3 indirectness (mechanism, or "no") | Interested party? (and effect) | Cluster | Claim | R1 Chance | R2 Reverse | R3 Confounder | R4 Artifact | R5 Fabrication | R6 Mundane |
|---|---|---|---|---|---|---|---|---|---|---|---|
| <origin-id> | supports / opposes | | | A | C / I / N | | | | | | |

Marks: C consistent, I inconsistent, N not applicable. A line marked C for the claim AND C for any live rival is non-diagnostic and is excluded from the band.
Add a column per extra rival you generate.

## 4. Independence

| Cluster | Members | Shared channel(s): data / method / institution / motive |
|---|---|---|
| A | | |

## 5. What is left out

**Contrary-evidence search** (what you searched, where, what you found; each find becomes an origin and a ledger row):
- <...>

**Silence check** (if true, what evidence should exist; is it absent; how strongly expected):
- <...>

## 6. Rivals

| Rival | Statement (specific to this claim) | Rebuttal status: rebutted / unrebutted / partially | Which ledger lines rebut it |
|---|---|---|---|
| R1 Chance | | | |
| R2 Reverse causation | | | |
| R3 Confounding | | | |
| R4 Selection/measurement artifact | | | |
| R5 Deliberate fabrication | | | |
| R6 Mundane alternative | | | |

## 7. Adversarial history

**Status:** <survived | failed | untested>
**Specifics:** <who tried, with what competence, access and mandate; when; what happened>

## 8. Steelman

<Strongest case against the claim, full strength. If writing it changed an earlier step, say which and what you re-ran.>

## 9. Band

<!-- COMPUTED. Do not write. The tool fills this: band, qualifier, tree, conditions met, capping conditions, and the band definition. -->

## 10. What would change this verdict

- <the cheapest piece of evidence that would move the band, and which way>

## 11. Scope and non-inference

**Exactly what was banded:** <...>
**Adjacent claims a reader may conflate with it** (each is unevaluated here unless linked):
- <...>
