import type { LedgerInput, EvidenceLine, Cluster, ContaminationChannel, Rival } from '../schema/ledger.js';
import { gradeWarrant, survives } from './weight.js';
import { buildClusters, buildDependenceMap } from './clusters.js';
import { markRivalsRebutted, computeDiagnosticity } from './diagnosticity.js';

export interface NormalizedLedger {
  /** All lines, survived or not (survived lines are also reported per FR-018's "still reported"). */
  lines: EvidenceLine[];
  survivingLines: EvidenceLine[];
  clusters: Cluster[];
  dependenceMap: { clusterId: string; channels: ContaminationChannel[]; memberLineIds: string[] }[];
  rivals: Rival[];
  /** True when a load-bearing origin was retracted, per FR-032's Refuted condition. */
  hasRetractedOrigin: boolean;
}

export function normalize(input: LedgerInput): NormalizedLedger {
  const gradedOrNull = input.origins.map((origin) => {
    const warrant = input.warrants.find((w) => w.originId === origin.id);
    if (!warrant) return null;
    return gradeWarrant(origin, warrant);
  });

  const hasRetractedOrigin = input.origins.some((o) => o.retracted);
  const gradedWarrants = gradedOrNull.filter((g): g is NonNullable<typeof g> => g !== null);

  const survivingWarrants = gradedWarrants.filter((w) => survives(w.finalGrade));
  const survivingOriginIds = survivingWarrants.map((w) => w.originId);

  const { clusters, originIdToClusterId } = buildClusters(survivingWarrants);
  const dependenceMap = buildDependenceMap(clusters);

  const ratedRivals = markRivalsRebutted(input.rivals, survivingOriginIds, input.diagnosticityEntries);
  const diagBy = computeDiagnosticity(survivingOriginIds, input.diagnosticityEntries, ratedRivals);

  const lines: EvidenceLine[] = gradedWarrants.map((w) => {
    const isSurviving = survives(w.finalGrade);
    const diag = diagBy.get(w.originId);
    return {
      originId: w.originId,
      finalGrade: w.finalGrade,
      survives: isSurviving,
      diagnosticity: diag?.diagnosticity ?? { claim: 'not_applicable', rivals: {} },
      nonDiagnostic: diag?.nonDiagnostic ?? false,
      clusterId: isSurviving ? (originIdToClusterId.get(w.originId) ?? null) : null,
    };
  });

  return {
    lines,
    survivingLines: lines.filter((l) => l.survives),
    clusters,
    dependenceMap,
    rivals: ratedRivals,
    hasRetractedOrigin,
  };
}
