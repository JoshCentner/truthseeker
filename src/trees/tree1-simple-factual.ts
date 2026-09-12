import type { LedgerInput, ConditionRef, WarrantGrade } from '../schema/ledger.js';
import { WARRANT_GRADE_ORDER } from '../schema/ledger.js';
import type { NormalizedLedger } from '../normalize/index.js';
import type { TreeResult } from './types.js';

export type { TreeResult } from './types.js';

function atLeast(grade: WarrantGrade, floor: WarrantGrade): boolean {
  return WARRANT_GRADE_ORDER.indexOf(grade) >= WARRANT_GRADE_ORDER.indexOf(floor);
}

const cond = (id: string, protocolClause: string): ConditionRef => ({ id, protocolClause });

/**
 * Tree 1 (simple factual claims). FR-021 through FR-024, FR-031, FR-032, FR-034.
 * No model call anywhere in this path — every branch is a fixed condition over
 * the already-normalized ledger.
 */
export function evaluateTree1(input: LedgerInput, normalized: NormalizedLedger): TreeResult {
  const met: ConditionRef[] = [];
  const capping: ConditionRef[] = [];

  // FR-032: Refuted takes priority — a retracted load-bearing origin is a
  // falsity finding, never substituted with a burden finding.
  if (normalized.hasRetractedOrigin) {
    return {
      band: 'refuted',
      qualifier: null,
      conditionsMet: [cond('T1-REFUTED', 'Tree 1: load-bearing origin retracted')],
      cappingConditions: [],
    };
  }

  // FR-032: nothing survives at any weight -> Unsupported (burden finding, not Contested/Refuted).
  if (normalized.survivingLines.length === 0) {
    return {
      band: 'unsupported',
      qualifier: null,
      conditionsMet: [cond('T1-UNSUPPORTED', 'Tree 1: nothing survives normalization')],
      cappingConditions: [],
    };
  }

  const diagnosticLines = normalized.survivingLines.filter((l) => !l.nonDiagnostic);

  // FR-018/FR-023: everything non-diagnostic (or diagnosticLines empty) -> Contested, insufficient evidence.
  if (diagnosticLines.length === 0) {
    return {
      band: 'contested',
      qualifier: 'insufficient_evidence',
      conditionsMet: [cond('T1-ALL-NONDIAGNOSTIC', 'Tree 1: no diagnostic evidence survives (FR-023)')],
      cappingConditions: [cond('T1-CAP-NONDIAGNOSTIC', 'no line separates the claim from a live rival')],
    };
  }

  const clusterCount = new Set(diagnosticLines.map((l) => l.clusterId).filter((id): id is string => id !== null)).size;
  const bestGrade = normalized.clusters
    .filter((c) => diagnosticLines.some((l) => l.clusterId === c.id))
    .reduce<WarrantGrade>((acc, c) => (atLeast(c.grade, acc) ? c.grade : acc), 'assertion');

  // FR-024: corroboration minimum is exactly two clusters, never a threshold above two.
  met.push(cond('T1-CLUSTER-COUNT', `FR-024: cluster count = ${clusterCount}`));

  // FR-022/FR-023: sole support is a single post-dispute testimony cluster.
  if (clusterCount === 1 && bestGrade === 'testimony') {
    return {
      band: 'contested',
      qualifier: 'insufficient_evidence',
      conditionsMet: met,
      cappingConditions: [cond('T1-CAP-SINGLE-TESTIMONY', 'sole support is one post-dispute testimony cluster')],
    };
  }

  // FR-034 (clarified): Contested — conflicting evidence only on an exact match
  // of grade AND cluster count between diagnostic evidence on both sides of the
  // claim. This engine's ledger shape carries only claim-supporting diagnostic
  // lines directly; opposing-side comparability is represented via any rival
  // whose evidence is itself expressed as a mirrored ledger — out of scope for
  // this single-ledger call, so this branch is reachable only when the caller
  // (a future feature) supplies that comparison explicitly. For Tree 1 alone,
  // conflicting evidence never fires without a second side to compare against.

  const rivalUnrebutted = normalized.rivals.find((r) => !r.rebutted);
  if (rivalUnrebutted) {
    capping.push(cond('T1-CAP-UNREBUTTED-RIVAL', `rival ${rivalUnrebutted.id} is unrebutted`));
    if (rivalUnrebutted.plausibilityRelativeToClaim === 'more_plausible') {
      return {
        band: 'contested',
        qualifier: 'insufficient_evidence',
        conditionsMet: met,
        cappingConditions: capping,
      };
    }
  }

  const isExtraordinary = input.screens.priorPlausibility === 'extraordinary';
  const extraordinarySatisfied = input.extraordinaryClusterSurvivedAdversarialTesting === true;

  // FR-031 (clarified): EXTRAORDINARY gates both Probable and Established; the
  // qualifying cluster must have ITSELF survived adversarial testing.
  if (isExtraordinary && !extraordinarySatisfied) {
    capping.push(cond('T1-CAP-EXTRAORDINARY', 'EXTRAORDINARY: no cluster has itself survived adversarial testing'));
    return { band: 'contested', qualifier: 'insufficient_evidence', conditionsMet: met, cappingConditions: capping };
  }
  if (isExtraordinary) {
    met.push(cond('T1-EXTRAORDINARY-SATISFIED', 'EXTRAORDINARY: qualifying cluster survived adversarial testing'));
  }

  const noStrongSilence = input.silenceFinding !== 'strong';
  const establishedGradeFloor = atLeast(bestGrade, 'contemporaneous_record');
  const establishedClusterFloor = clusterCount >= 2;
  const establishedAdversarial = input.adversarialStatus === 'survived';
  const establishedRivalOk = !rivalUnrebutted;

  if (establishedGradeFloor && establishedClusterFloor && establishedRivalOk && noStrongSilence && establishedAdversarial) {
    met.push(
      cond('T1-ESTABLISHED', 'FR-021: 2+ clusters, best >= contemporaneous_record, no unrebutted rival, no strong silence, adversarial survived'),
    );
    return { band: 'established', qualifier: null, conditionsMet: met, cappingConditions: [] };
  }

  // Probable: same shape, but adversarial Untested caps it here.
  if (establishedGradeFloor && establishedClusterFloor && establishedRivalOk && noStrongSilence) {
    if (input.adversarialStatus === 'untested') {
      capping.push(cond('T1-CAP-ADVERSARIAL-UNTESTED', 'adversarial status untested caps Established'));
    }
    met.push(cond('T1-PROBABLE', 'FR-021 shape met at Probable strength'));
    return { band: 'probable', qualifier: null, conditionsMet: met, cappingConditions: capping };
  }

  if (!establishedClusterFloor) {
    capping.push(cond('T1-CAP-CORROBORATION', 'FR-024: fewer than two independent clusters'));
  }
  if (!establishedGradeFloor) {
    capping.push(cond('T1-CAP-GRADE', 'best surviving grade below contemporaneous_record'));
  }
  if (input.silenceFinding === 'strong') {
    capping.push(cond('T1-CAP-SILENCE', 'strong silence finding'));
  }

  return {
    band: 'contested',
    qualifier: 'insufficient_evidence',
    conditionsMet: met,
    cappingConditions: capping.length > 0 ? capping : [cond('T1-CAP-GENERIC', 'conditions for a higher band not met')],
  };
}
