import type { Cluster, ContaminationChannel, GradedWarrant, WarrantGrade } from '../schema/ledger.js';
import { WARRANT_GRADE_ORDER } from '../schema/ledger.js';

const CHANNELS: ContaminationChannel[] = ['data', 'method', 'institution', 'motive'];

function bestGrade(a: WarrantGrade, b: WarrantGrade): WarrantGrade {
  return WARRANT_GRADE_ORDER.indexOf(a) >= WARRANT_GRADE_ORDER.indexOf(b) ? a : b;
}

/**
 * FR-016/FR-017/FR-020: partitions surviving lines into dependency clusters via
 * union-find over shared channel keys (direct or transitive), grades each
 * cluster as its best member, and reports which lines share which channels.
 */
export function buildClusters(survivingWarrants: GradedWarrant[]): {
  clusters: Cluster[];
  originIdToClusterId: Map<string, string>;
} {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    // path compression
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur) as string;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const w of survivingWarrants) {
    parent.set(w.originId, w.originId);
  }

  // Union any two lines that share a non-null key on the same channel.
  for (const channel of CHANNELS) {
    const byKey = new Map<string, string[]>();
    for (const w of survivingWarrants) {
      const key = w.channelKeys[channel];
      if (key === null) continue;
      const bucket = byKey.get(key) ?? [];
      bucket.push(w.originId);
      byKey.set(key, bucket);
    }
    for (const ids of byKey.values()) {
      for (let i = 1; i < ids.length; i++) {
        union(ids[0] as string, ids[i] as string);
      }
    }
  }

  const rootToMembers = new Map<string, string[]>();
  for (const w of survivingWarrants) {
    const root = find(w.originId);
    const bucket = rootToMembers.get(root) ?? [];
    bucket.push(w.originId);
    rootToMembers.set(root, bucket);
  }

  const gradeByOriginId = new Map(survivingWarrants.map((w) => [w.originId, w.finalGrade] as const));

  const clusters: Cluster[] = [];
  const originIdToClusterId = new Map<string, string>();
  let clusterCounter = 0;
  for (const [, memberLineIds] of rootToMembers) {
    const clusterId = `cluster-${clusterCounter++}`;
    const sharedChannels = CHANNELS.filter((channel) => {
      const keys = new Set(
        memberLineIds
          .map((id) => survivingWarrants.find((w) => w.originId === id)?.channelKeys[channel] ?? null)
          .filter((k): k is string => k !== null),
      );
      return keys.size > 0 && memberLineIds.length > 1;
    });
    const grade = memberLineIds.reduce<WarrantGrade>(
      (acc, id) => bestGrade(acc, gradeByOriginId.get(id) as WarrantGrade),
      'assertion',
    );
    clusters.push({ id: clusterId, memberLineIds, sharedChannels, grade });
    for (const id of memberLineIds) {
      originIdToClusterId.set(id, clusterId);
    }
  }

  return { clusters, originIdToClusterId };
}

/** FR-020: dependence map naming which lines cluster on which shared channels. */
export function buildDependenceMap(
  clusters: Cluster[],
): { clusterId: string; channels: ContaminationChannel[]; memberLineIds: string[] }[] {
  return clusters
    .filter((c) => c.memberLineIds.length > 1)
    .map((c) => ({ clusterId: c.id, channels: c.sharedChannels, memberLineIds: c.memberLineIds }));
}
