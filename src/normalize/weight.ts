import type { Origin, Warrant, GradedWarrant, WarrantGrade } from '../schema/ledger.js';
import { WARRANT_GRADE_ORDER } from '../schema/ledger.js';

function stepDown(grade: WarrantGrade): WarrantGrade {
  const i = WARRANT_GRADE_ORDER.indexOf(grade);
  return WARRANT_GRADE_ORDER[Math.max(0, i - 1)] as WarrantGrade;
}

function stepUp(grade: WarrantGrade): WarrantGrade {
  const i = WARRANT_GRADE_ORDER.indexOf(grade);
  // FR-013: no upgrade may cross physical_documentary.
  const ceilingIndex = WARRANT_GRADE_ORDER.indexOf('physical_documentary');
  return WARRANT_GRADE_ORDER[Math.min(ceilingIndex, i + 1)] as WarrantGrade;
}

/**
 * Grades one origin. Returns null when the origin's line is removed entirely
 * (T019/T020: retracted, or could-not-retrieve forces bare assertion — which
 * itself is not a removal, so only `retracted` returns null here).
 */
export function gradeWarrant(origin: Origin, warrant: Warrant): GradedWarrant | null {
  if (origin.retracted) {
    // FR-010: retracted origin's entire downstream line is removed.
    return null;
  }

  // FR-011: could-not-retrieve forces bare assertion regardless of claimed type.
  let grade: WarrantGrade =
    origin.retrievalStatus === 'could_not_retrieve' ? 'assertion' : warrant.startingGrade;

  // FR-012: one grade step per fired trigger, no limit. Reject (skip) any
  // trigger with no mechanism — the validation layer already guarantees
  // firedTriggers entries carry a non-empty mechanism, so this is a defensive
  // second check, not the primary enforcement point.
  for (const trigger of warrant.firedTriggers) {
    if (!trigger.mechanism || trigger.mechanism.trim().length === 0) {
      continue;
    }
    if (trigger.direction === 'downgrade') {
      grade = stepDown(grade);
    } else {
      grade = stepUp(grade); // FR-013: capped at physical_documentary by stepUp itself.
    }
  }

  // FR-014: interested-party table, applied by warrant grade.
  if (warrant.interestedParty) {
    if (grade === 'contemporaneous_record' && warrant.partyControlledCreationAfterStakesVisible) {
      grade = 'testimony';
    }
    // physical_documentary and re-testable evidence: no discount (grade unchanged).
    // testimony/assertion: interested-party status does not change their grade
    // further here — testimony already carries corroboration value only, and
    // assertion is already zero-weight regardless.
  }

  // FR-015: source-reliability interaction is downward-only; it can never
  // raise a grade or convert assertion into evidence.
  if (warrant.sourceReliabilityGrade === 'fabricator' || warrant.sourceReliabilityGrade === 'poor') {
    if (grade !== 'assertion') {
      grade = stepDown(grade);
    }
  }

  return { ...warrant, finalGrade: grade };
}

/** FR-009: bare assertion carries zero weight at any volume; testimony is never zeroed by this rule. */
export function survives(finalGrade: WarrantGrade): boolean {
  return finalGrade !== 'assertion';
}
