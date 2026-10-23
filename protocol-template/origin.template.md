---
templateVersion: 0.1.0
claimKind: origin
id: <origin-id>
retrieved: <YYYY-MM-DD>
url: <where the origin itself was fetched, not a downstream copy>
---

<!--
FILL-IN RULES
- One file per ORIGIN (where the evidence first entered the record), in origins/. Grade it once; every claim that cites it reuses the grade.
- Only claim-INDEPENDENT facts go here. Claim-relative judgments (D3 indirectness, interested party, diagnostic marks) go in the citing claim's ledger row.
- Everything below must be verified by fetching at evaluation time. Memory is not evidence. If you could not verify it, write "unverified" and grade accordingly.
-->

## Provenance

**What it is:** <study / filing / dataset / recording / person's account / ...>
**Chain** (downstream source -> ... -> origin): <...>
**Status:** <retrievable | not retrievable (=> bare assertion) | retracted (=> zero, line removed) | corrected | mutated downstream>
**If mutated:** origin says "<...>", circulating version says "<...>". Band the origin version only.

## Warrant

**Starting grade:** <retestable | physical_or_documentary | contemporaneous_record | testimony | assertion>
**Dead-end derivative?** <no | yes -> graded as testimony (own work) / assertion (others' untraceable work)>

| Trigger | Safeguard missing? | Named mechanism by which it could produce the result if the claim were false | Fired? |
|---|---|---|---|
| D1a comparison / control | | | |
| D1b blinded / automated / independent measurement | | | |
| D1c selection method stated and non-arbitrary (cannot determine = no) | | | |
| D1d outcomes specified before results (cannot determine = no) | | | |
| D2 imprecision as precision | | | |
| D4 internal inconsistency | | | |

(D3 indirectness is claim-relative: record it in the citing claim.)

**Upgrades verified** (independent replication, pre-registration; cannot go above physical_or_documentary): <none | what and where verified>
**Final grade:** <starting grade, minus fired triggers, plus verified upgrades>

## Source reliability

**Grade:** <strong | mixed | unknown | poor | fabricator>
**Basis** (verified lookups only; domain-relevant where possible): <...>
**Intent evidence if fabricator:** <...>
