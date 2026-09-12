import type { Band, Qualifier, ConditionRef } from '../schema/ledger.js';

export interface TreeResult {
  /**
   * null only for Tree 4's decomposable branch (FR-029): a decomposable
   * complex-system claim's actual band comes from evaluating its named
   * sub-claims independently and combining them with aggregate() (User Story
   * 5) — the claim graph itself is out of this feature's scope (spec.md
   * Assumptions). Every other tree always returns a concrete Band.
   */
  band: Band | null;
  qualifier: Qualifier | null;
  conditionsMet: ConditionRef[];
  cappingConditions: ConditionRef[];
  /** Set only by Tree 4's decomposable branch when residue is left uncaptured. */
  residue?: string | null;
}
