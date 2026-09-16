import type { Claim } from './corpus.js';

/**
 * Relationship resolution and DAG enforcement (FR-010, FR-011).
 *
 * The constitution requires cycle detection at edge-insert time. There is no
 * insert API here — edges arrive as committed files — so detection runs on every
 * read instead, which is strictly more often than every insert: no edge can be
 * acted on without having been checked.
 *
 * Failures name every claim involved, not just the first one found. A corpus
 * error is read by a contributor who cannot see this code, and "cycle detected"
 * without the participants is an error message that makes them do the search
 * the computer already did.
 */

export interface Edge {
  from: string;
  to: string;
  type: 'load_bearing' | 'supplementary' | 'supersedes';
}

export interface Graph {
  edges: Edge[];
  childrenOf: Map<string, { id: string; restatement: string; edgeType: string }[]>;
  supersededBy: Map<string, { id: string; restatement: string }>;
}

export class GraphError extends Error {}

export function buildGraph(claims: Claim[]): Graph {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const edges: Edge[] = [];

  for (const claim of claims) {
    const { parentClaim, edgeType, supersedes } = claim.record;

    if (parentClaim) {
      if (!byId.has(parentClaim)) {
        throw new GraphError(
          `${claim.id}/claim.md names parentClaim "${parentClaim}", which is not a claim in this corpus.\n` +
            `  A relationship pointing at nothing is dropped silently by no part of this system (FR-011):\n` +
            `  either add that claim, or correct the reference.`,
        );
      }
      edges.push({ from: claim.id, to: parentClaim, type: edgeType as 'load_bearing' | 'supplementary' });
    }

    if (supersedes) {
      if (!byId.has(supersedes)) {
        throw new GraphError(
          `${claim.id}/claim.md names supersedes "${supersedes}", which is not a claim in this corpus.\n` +
            `  A superseded claim stays published precisely so citations against it keep working, so the\n` +
            `  reference must resolve.`,
        );
      }
      edges.push({ from: claim.id, to: supersedes, type: 'supersedes' });
    }
  }

  detectCycles(claims.map((c) => c.id), edges);

  const childrenOf = new Map<string, { id: string; restatement: string; edgeType: string }[]>();
  const supersededBy = new Map<string, { id: string; restatement: string }>();

  for (const edge of edges) {
    const child = byId.get(edge.from) as Claim;
    const label = child.record.canonicalRestatement ?? child.id;
    if (edge.type === 'supersedes') {
      supersededBy.set(edge.to, { id: edge.from, restatement: label });
    } else {
      const bucket = childrenOf.get(edge.to) ?? [];
      bucket.push({ id: edge.from, restatement: label, edgeType: edge.type });
      childrenOf.set(edge.to, bucket);
    }
  }

  // Deterministic order regardless of read order (research.md §8).
  for (const bucket of childrenOf.values()) bucket.sort((a, b) => a.id.localeCompare(b.id));

  return { edges, childrenOf, supersededBy };
}

/** Iterative DFS with an explicit stack, recording the path so a detected cycle
 * can be reported with every claim on it. */
function detectCycles(ids: string[], edges: Edge[]): void {
  const out = new Map<string, string[]>();
  for (const id of ids) out.set(id, []);
  for (const e of edges) out.get(e.from)?.push(e.to);

  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const colour = new Map<string, number>(ids.map((id) => [id, WHITE]));

  const visit = (start: string): void => {
    const path: string[] = [];
    const stack: { node: string; index: number }[] = [{ node: start, index: 0 }];
    colour.set(start, GREY);
    path.push(start);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1] as { node: string; index: number };
      const neighbours = out.get(frame.node) ?? [];
      if (frame.index >= neighbours.length) {
        colour.set(frame.node, BLACK);
        stack.pop();
        path.pop();
        continue;
      }
      const next = neighbours[frame.index] as string;
      frame.index++;

      if (colour.get(next) === GREY) {
        const from = path.indexOf(next);
        const cycle = [...path.slice(from), next];
        throw new GraphError(
          `relationship cycle detected, involving ${cycle.length - 1} claim(s):\n` +
            cycle.map((id, i) => `  ${i === 0 ? ' ' : '→'} ${id}`).join('\n') +
            `\n  Claim relationships must form a directed acyclic graph. Mutually load-bearing claims make a\n` +
            `  band impossible to compute, because each one's verdict would depend on the other's.`,
        );
      }
      if (colour.get(next) === WHITE) {
        colour.set(next, GREY);
        path.push(next);
        stack.push({ node: next, index: 0 });
      }
    }
  };

  for (const id of [...ids].sort()) {
    if (colour.get(id) === WHITE) visit(id);
  }
}
