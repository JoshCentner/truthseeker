---
corpusSchemaVersion: 0.1.0
claimKind: claim
canonicalRestatement: |
  In 2016, 80% of the world's wealth was owned by 80 people; in 2026 it is owned by 8 people.
---

## About this claim

A circulating wealth-inequality statistic, submitted with the requester's own caveat that "the
numbers may be wrong". It reads as a mangled version of Oxfam's annual Davos comparisons. Those
said that a small number of the richest people (85, then 80, 62 and 8 in successive years) own
**as much as the poorest half of humanity**. That half holds under 1% of global wealth, so the
comparison was never about owning 80% of it. The "8" figure dates from January 2017, not 2026, and
Oxfam's January 2026 comparison uses twelve people.

Worth noting when reading the ledger:

- The scale gap is the load-bearing point. It does not depend on the precise headcounts, which Oxfam itself revised heavily (its 2016 "62" became "9" on better data).
- Three origins are Oxfam releases, and the fact-check re-derives Oxfam's figure from the same Credit Suisse and Forbes inputs. They are not independent of one another. Contamination-channel keys are not yet populated (TASKS.md F-11a), so the engine counted them as separate clusters.
- The refutation was not adversarially tested from the claim's side. That step does not exist yet (TASKS.md F-16), and under engine 0.3.0 this record is expected to drift from Refuted.

## How this record was produced

See the provenance block on the generated report. Records produced through `tools/manual-run/`
were answered step by step by a human-driven session rather than by an unattended pipeline run,
so the blind-grading guarantee of Constitution Principle II held as a discipline rather than as
an architectural property. The report states this; do not read such a record as protocol-clean.
