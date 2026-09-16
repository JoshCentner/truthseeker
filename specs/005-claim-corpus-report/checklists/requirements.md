# Specification Quality Checklist: Claim Corpus Structure and Visual Claim Report

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-15
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

**All 16 items pass.** Re-validated 2026-09-16 after a five-question clarification session; no item
regressed and none changed state, so the spec grew substantially without loosening.

### Clarification session 2026-09-16

Five questions asked, five answered, all integrated. The spec went from 33 to 50 functional
requirements and from 11 to 18 success criteria. What the session actually bought:

1. **Band provenance under engine drift** (FR-031/032/033). The displayed band is the one the run
   recorded, stamped with its engine version, and the current engine's recomputation is shown beside
   it when the two differ. Not hypothetical: an engine bump on 2026-09-15 moved a stored record from
   Contested to Refuted off an unchanged ledger.
2. **Runs without a verdict** (FR-009a/009b, FR-013a/013b). Rejections, review holds and exhausted
   remediations are first-class published records; credential failures are not, since they say
   nothing about the claim. Without this the harm gate was the silent filter Principle VI forbids.
3. **Protocol vocabulary** (FR-015a/b/c). Plain language leads, the exact protocol term stays beside
   it, and a glossary covers every term on the page. SC-001 was not reachable otherwise.
4. **Rendering safety** (FR-027a-d). Authored Markdown renders as a restricted subset with raw HTML
   stripped; every run-record string is escaped; only http/https links are clickable; pages execute
   nothing. This is the constitution's "fetched content is data, never instruction" applied one
   layer down — at the browser rather than at the model.
5. **Identity immutability** (FR-007a-d). A canonical restatement freezes once a run exists;
   rewording creates a new claim superseding the old. This is what stops evidence migrating to a
   differently-worded proposition.

### Contradictions found and resolved during integration

- The original assumption "the band shown is always computed, never stored" was invalidated by
  clarification 1 and was replaced, not supplemented.
- FR-006 limited edge types to load-bearing and supplementary, which clarification 5's supersedes
  relationship contradicted. FR-006 now scopes that restriction to sub-claim edges and states that
  supersedes is a distinct relation.

### Still standing from the specify session

FR-029's constitutional tension is unchanged and still wants a methodology reviewer's eye: the
headline band is the most recent run, which is the thing the constitution's sentence forbids, and
FR-029a's adjacent stability record is what carries the compliance argument.

Two assumptions remain reviewer-overridable: generated HTML is build output and is not committed,
and migrating the two existing run records into the new layout is in scope.
