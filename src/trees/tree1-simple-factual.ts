import type { LedgerInput, ConditionRef, WarrantGrade, EvidenceLine } from '../schema/ledger.js';
import { WARRANT_GRADE_ORDER } from '../schema/ledger.js';
import type { NormalizedLedger } from '../normalize/index.js';
import type { TreeResult } from './types.js';

export type { TreeResult } from './types.js';

function atLeast(grade: WarrantGrade, floor: WarrantGrade): boolean {
  return WARRANT_GRADE_ORDER.indexOf(grade) >= WARRANT_GRADE_ORDER.indexOf(floor);
}

const cond = (id: string, protocolClause: string): ConditionRef => ({ id, protocolClause });

interface SideStrength {
  clusterCount: number;
  bestGrade: WarrantGrade;
}

/**
 * Corroboration arithmetic over ONE side of the claim. A cluster counts on
 * whichever side its member lines fall: if one cluster somehow holds both a
 * supporting and an opposing line (possible only when the two share a
 * contamination-channel key) it counts on both, which is the conservative
 * reading — shared provenance should not let either side claim it exclusively.
 */
function strengthOf(lines: EvidenceLine[], normalized: NormalizedLedger): SideStrength {
  const clusterIds = new Set(lines.map((l) => l.clusterId).filter((id): id is string => id !== null));
  const bestGrade = normalized.clusters
    .filter((c) => clusterIds.has(c.id))
    .reduce<WarrantGrade>((acc, c) => (atLeast(c.grade, acc) ? c.grade : acc), 'assertion');
  return { clusterCount: clusterIds.size, bestGrade };
}

/** -1 / 0 / +1 for how `a` compares to `b`, by grade first, then cluster count. */
function compareSides(a: SideStrength, b: SideStrength): number {
  const ga = WARRANT_GRADE_ORDER.indexOf(a.bestGrade);
  const gb = WARRANT_GRADE_ORDER.indexOf(b.bestGrade);
  if (ga !== gb) return ga > gb ? 1 : -1;
  if (a.clusterCount !== b.clusterCount) return a.clusterCount > b.clusterCount ? 1 : -1;
  return 0;
}

/**
 * Tree 1 (simple factual claims). FR-021 through FR-024, FR-031, FR-032, FR-034.
 * No model call anywhere in this path — every branch is a fixed condition over
 * the already-normalized ledger.
 *
 * METHODOLOGY CHANGE (engine 0.2.0, 2026-09-15) — requires methodology review
 * per the constitution's "Engine and registry changes are methodology changes."
 *
 * Before this revision every surviving diagnostic line counted toward the
 * corroboration threshold regardless of its diagnosticity mark, so evidence
 * that CONTRADICTED a claim was arithmetically indistinguishable from evidence
 * supporting it: a ledger whose every line was marked `inconsistent` could
 * reach Established, which is precisely the overclaiming Principle I exists to
 * make structurally impossible. Two changes follow from fixing that:
 *
 *  1. Only lines marked `consistent` with the claim corroborate it. Lines
 *     marked `inconsistent` form an opposing side carrying its own cluster
 *     count and grade; `not_applicable` lines corroborate neither side.
 *  2. Refuted becomes reachable from counter-evidence rather than only from a
 *     retracted origin. The bar mirrors Established's own floors — two or more
 *     opposing clusters, best opposing grade at contemporaneous_record or
 *     better, no strong silence finding. That is Principle II's mirror rule
 *     expressed as arithmetic: refuting a claim takes exactly what
 *     establishing one takes, no less and no more.
 *
 * Principle II's burden rule is preserved throughout — absence of support is
 * never read as support, and a claim nothing supports lands at Unsupported
 * unless the opposing side independently clears the refutation bar.
 */
export function evaluateTree1(input: LedgerInput, normalized: NormalizedLedger): TreeResult {
  const met: ConditionRef[] = [];
  const capping: ConditionRef[] = [];
  const noStrongSilence = input.silenceFinding !== 'strong';

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

  const support = strengthOf(
    diagnosticLines.filter((l) => l.diagnosticity.claim === 'consistent'),
    normalized,
  );
  const counter = strengthOf(
    diagnosticLines.filter((l) => l.diagnosticity.claim === 'inconsistent'),
    normalized,
  );
  const counterMeetsRefutationBar =
    counter.clusterCount >= 2 && atLeast(counter.bestGrade, 'contemporaneous_record') && noStrongSilence;

  // Nothing is marked consistent with the claim: the claimant's burden is unmet.
  if (support.clusterCount === 0) {
    if (counterMeetsRefutationBar) {
      return {
        band: 'refuted',
        qualifier: null,
        conditionsMet: [
          cond(
            'T1-REFUTED-COUNTER',
            `counter-evidence clears the mirrored Established bar: ${counter.clusterCount} opposing clusters, best grade ${counter.bestGrade}`,
          ),
        ],
        cappingConditions: [],
      };
    }
    return {
      band: 'unsupported',
      qualifier: null,
      conditionsMet: [
        cond('T1-UNSUPPORTED-NO-SUPPORT', 'no surviving diagnostic line is marked consistent with the claim'),
      ],
      cappingConditions:
        counter.clusterCount > 0
          ? [
              cond(
                'T1-CAP-COUNTER-BELOW-BAR',
                `opposing evidence present but below the refutation bar: ${counter.clusterCount} cluster(s), best grade ${counter.bestGrade}`,
              ),
            ]
          : [],
    };
  }

  // FR-024: corroboration minimum is exactly two clusters, never a threshold above two.
  met.push(cond('T1-CLUSTER-COUNT', `FR-024: corroborating cluster count = ${support.clusterCount}`));

  if (counter.clusterCount > 0) {
    met.push(
      cond(
        'T1-COUNTER-COUNT',
        `opposing cluster count = ${counter.clusterCount}, best opposing grade ${counter.bestGrade}`,
      ),
    );
    const sides = compareSides(counter, support);

    // Opposition outweighs the support and independently clears the refutation bar.
    if (sides > 0 && counterMeetsRefutationBar) {
      return {
        band: 'refuted',
        qualifier: null,
        conditionsMet: [
          ...met,
          cond(
            'T1-REFUTED-COUNTER-OUTWEIGHS',
            'opposing evidence outweighs the supporting side and clears the refutation bar',
          ),
        ],
        cappingConditions: [],
      };
    }

    // FR-034 (clarified): Contested — conflicting evidence on an exact match of
    // grade AND cluster count between diagnostic evidence on both sides. The
    // original note called this branch unreachable because the engine had no way
    // to tell the sides apart; now that diagnosticity marks separate them, it
    // fires as the clarification always intended.
    if (sides === 0) {
      return {
        band: 'contested',
        qualifier: 'conflicting_evidence',
        conditionsMet: met,
        cappingConditions: [
          cond(
            'T1-CAP-CONFLICTING',
            'FR-034: opposing and supporting evidence match exactly on both grade and cluster count',
          ),
        ],
      };
    }

    // Opposition stronger but short of the refutation bar: the claim cannot rise
    // above Contested while better evidence points the other way.
    if (sides > 0) {
      return {
        band: 'contested',
        qualifier: 'insufficient_evidence',
        conditionsMet: met,
        cappingConditions: [cond('T1-CAP-COUNTER-OUTWEIGHS', 'opposing evidence outweighs the supporting side')],
      };
    }

    // Opposition weaker, but its survival still blocks Established below.
    capping.push(cond('T1-CAP-COUNTER-PRESENT', 'surviving diagnostic evidence contradicts the claim'));
  }

  // FR-022/FR-023: sole support is a single post-dispute testimony cluster.
  if (support.clusterCount === 1 && support.bestGrade === 'testimony') {
    return {
      band: 'contested',
      qualifier: 'insufficient_evidence',
      conditionsMet: met,
      cappingConditions: [
        ...capping,
        cond('T1-CAP-SINGLE-TESTIMONY', 'sole support is one post-dispute testimony cluster'),
      ],
    };
  }

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

  const establishedGradeFloor = atLeast(support.bestGrade, 'contemporaneous_record');
  const establishedClusterFloor = support.clusterCount >= 2;
  const establishedAdversarial = input.adversarialStatus === 'survived';
  const establishedRivalOk = !rivalUnrebutted;
  // A claim cannot be Established while surviving diagnostic evidence contradicts it.
  const establishedNoCounter = counter.clusterCount === 0;

  if (
    establishedGradeFloor &&
    establishedClusterFloor &&
    establishedRivalOk &&
    noStrongSilence &&
    establishedAdversarial &&
    establishedNoCounter
  ) {
    met.push(
      cond(
        'T1-ESTABLISHED',
        'FR-021: 2+ clusters, best >= contemporaneous_record, no unrebutted rival, no strong silence, adversarial survived, no surviving counter-evidence',
      ),
    );
    return { band: 'established', qualifier: null, conditionsMet: met, cappingConditions: [] };
  }

  // Probable: same shape, but adversarial Untested (or surviving counter-evidence) caps it here.
  if (establishedGradeFloor && establishedClusterFloor && establishedRivalOk && noStrongSilence) {
    if (input.adversarialStatus === 'untested') {
      capping.push(cond('T1-CAP-ADVERSARIAL-UNTESTED', 'adversarial status untested caps Established'));
    }
    met.push(cond('T1-PROBABLE', 'FR-021 shape met at Probable strength'));
    return { band: 'probable', qualifier: null, conditionsMet: met, cappingConditions: capping };
  }

  if (!establishedClusterFloor) {
    capping.push(cond('T1-CAP-CORROBORATION', 'FR-024: fewer than two independent corroborating clusters'));
  }
  if (!establishedGradeFloor) {
    capping.push(cond('T1-CAP-GRADE', 'best surviving corroborating grade below contemporaneous_record'));
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
