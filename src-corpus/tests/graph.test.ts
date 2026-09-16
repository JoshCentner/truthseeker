import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readAllClaims } from '../corpus.js';
import { buildGraph, GraphError } from '../graph.js';
import { claimIdFor } from '../identity.js';

let root: string;

function claim(restatement: string, extra: string[] = []): string {
  const id = claimIdFor(restatement);
  const dir = path.join(root, 'claims', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'claim.md'),
    ['---', 'corpusSchemaVersion: 0.1.0', 'claimKind: claim', 'canonicalRestatement: |', `  ${restatement}`, ...extra, '---', '', 'Prose.', ''].join('\n'),
  );
  return id;
}

const graphOf = () => buildGraph(readAllClaims(root));

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-test-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('relationship graph (FR-010, FR-011)', () => {
  describe('valid shapes', () => {
    it('resolves a sub-claim to its parent, both as siblings on disk', () => {
      const parent = claim('The parent claim.');
      const child = claim('The child claim.', [`parentClaim: ${parent}`, 'edgeType: load_bearing']);

      // The point of the whole layout: neither directory is inside the other.
      expect(fs.existsSync(path.join(root, 'claims', parent))).toBe(true);
      expect(fs.existsSync(path.join(root, 'claims', child))).toBe(true);
      expect(fs.existsSync(path.join(root, 'claims', parent, child))).toBe(false);

      const g = graphOf();
      expect(g.childrenOf.get(parent)).toEqual([
        { id: child, restatement: 'The child claim.', edgeType: 'load_bearing' },
      ]);
    });

    it('resolves a supersedes edge in both directions', () => {
      const old = claim('The original wording.');
      const replacement = claim('The revised wording.', [`supersedes: ${old}`, 'supersedesConfirmedBy: josh']);
      const g = graphOf();
      expect(g.supersededBy.get(old)).toEqual({ id: replacement, restatement: 'The revised wording.' });
    });

    it('supports several sub-claims under one parent, in a stable order', () => {
      const parent = claim('The parent claim.');
      claim('Child A.', [`parentClaim: ${parent}`, 'edgeType: load_bearing']);
      claim('Child B.', [`parentClaim: ${parent}`, 'edgeType: supplementary']);
      const ids = (graphOf().childrenOf.get(parent) ?? []).map((c) => c.id);
      expect([...ids].sort()).toEqual(ids);
    });

    it('allows a diamond — two sub-claims sharing a parent is not a cycle', () => {
      const root_ = claim('Root.');
      claim('Left.', [`parentClaim: ${root_}`, 'edgeType: load_bearing']);
      claim('Right.', [`parentClaim: ${root_}`, 'edgeType: load_bearing']);
      expect(() => graphOf()).not.toThrow();
    });
  });

  describe('dangling references fail loudly (FR-011)', () => {
    it('refuses a parentClaim that does not exist, naming it', () => {
      claim('An orphan.', ['parentClaim: does-not-exist-00000000', 'edgeType: load_bearing']);
      expect(() => graphOf()).toThrow(/does-not-exist-00000000/);
    });

    it('does not silently drop the edge', () => {
      claim('An orphan.', ['parentClaim: does-not-exist-00000000', 'edgeType: load_bearing']);
      expect(() => graphOf()).toThrow(GraphError);
    });

    it('refuses a supersedes that does not exist', () => {
      claim('A replacement.', ['supersedes: missing-00000000', 'supersedesConfirmedBy: josh']);
      expect(() => graphOf()).toThrow(/missing-00000000/);
    });
  });

  describe('cycles fail naming every participant (FR-010, SC-007)', () => {
    it('detects a two-claim cycle and names both', () => {
      const a = claimIdFor('Claim A.');
      const b = claimIdFor('Claim B.');
      claim('Claim A.', [`parentClaim: ${b}`, 'edgeType: load_bearing']);
      claim('Claim B.', [`parentClaim: ${a}`, 'edgeType: load_bearing']);
      try {
        graphOf();
        expect.unreachable('should have thrown');
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toMatch(/cycle/i);
        expect(message, 'names claim A').toContain(a);
        expect(message, 'names claim B').toContain(b);
      }
    });

    it('detects a three-claim cycle and names all three', () => {
      const a = claimIdFor('Claim A.');
      const b = claimIdFor('Claim B.');
      const c = claimIdFor('Claim C.');
      claim('Claim A.', [`parentClaim: ${b}`, 'edgeType: load_bearing']);
      claim('Claim B.', [`parentClaim: ${c}`, 'edgeType: load_bearing']);
      claim('Claim C.', [`parentClaim: ${a}`, 'edgeType: load_bearing']);
      try {
        graphOf();
        expect.unreachable('should have thrown');
      } catch (err) {
        const message = (err as Error).message;
        for (const id of [a, b, c]) expect(message, id).toContain(id);
      }
    });

    it('treats a self-reference as a cycle of length one', () => {
      const a = claimIdFor('Claim A.');
      claim('Claim A.', [`parentClaim: ${a}`, 'edgeType: load_bearing']);
      expect(() => graphOf()).toThrow(/cycle/i);
    });

    it('detects a cycle formed across mixed edge types', () => {
      // A supersedes B, B is a sub-claim of A. Different edge types, still a
      // cycle, and still makes a band non-computable.
      const a = claimIdFor('Claim A.');
      const b = claimIdFor('Claim B.');
      claim('Claim A.', [`supersedes: ${b}`, 'supersedesConfirmedBy: josh']);
      claim('Claim B.', [`parentClaim: ${a}`, 'edgeType: load_bearing']);
      expect(() => graphOf()).toThrow(/cycle/i);
    });

    it('explains why a cycle is fatal rather than only reporting it', () => {
      const a = claimIdFor('Claim A.');
      claim('Claim A.', [`parentClaim: ${a}`, 'edgeType: load_bearing']);
      expect(() => graphOf()).toThrow(/band impossible to compute|depend on the other/i);
    });
  });

  it('the real corpus is acyclic and every reference resolves', () => {
    expect(() => buildGraph(readAllClaims('corpus'))).not.toThrow();
  });
});
