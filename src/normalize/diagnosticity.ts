import type { DiagnosticityEntry, DiagnosticMark, Rival } from '../schema/ledger.js';

export interface LineDiagnosticity {
  claim: DiagnosticMark;
  rivals: Record<string, DiagnosticMark>;
}

function marksFor(originId: string, entries: DiagnosticityEntry[]): LineDiagnosticity {
  const claimEntry = entries.find((e) => e.lineOriginId === originId && e.against === 'claim');
  const rivals: Record<string, DiagnosticMark> = {};
  for (const e of entries) {
    if (e.lineOriginId === originId && typeof e.against === 'object') {
      rivals[e.against.rivalId] = e.mark;
    }
  }
  return { claim: claimEntry?.mark ?? 'not_applicable', rivals };
}

/** FR-019: a rival is unrebutted when no surviving line marks it 'inconsistent'. */
export function markRivalsRebutted(rivals: Rival[], survivingOriginIds: string[], entries: DiagnosticityEntry[]): Rival[] {
  return rivals.map((rival) => {
    const rebutted = entries.some(
      (e) =>
        survivingOriginIds.includes(e.lineOriginId) &&
        typeof e.against === 'object' &&
        e.against.rivalId === rival.id &&
        e.mark === 'inconsistent',
    );
    return { ...rival, rebutted };
  });
}

/**
 * FR-018: a line consistent with the claim AND consistent with at least one
 * live (unrebutted) rival is non-diagnostic — excluded from cluster thresholds
 * and warrant requirements, but still reported.
 */
export function computeDiagnosticity(
  survivingOriginIds: string[],
  entries: DiagnosticityEntry[],
  rebuttedRivals: Rival[],
): Map<string, { diagnosticity: LineDiagnosticity; nonDiagnostic: boolean }> {
  const liveRivalIds = new Set(rebuttedRivals.filter((r) => !r.rebutted).map((r) => r.id));
  const result = new Map<string, { diagnosticity: LineDiagnosticity; nonDiagnostic: boolean }>();
  for (const originId of survivingOriginIds) {
    const diagnosticity = marksFor(originId, entries);
    const nonDiagnostic =
      diagnosticity.claim === 'consistent' &&
      Object.entries(diagnosticity.rivals).some(([rivalId, mark]) => mark === 'consistent' && liveRivalIds.has(rivalId));
    result.set(originId, { diagnosticity, nonDiagnostic });
  }
  return result;
}
