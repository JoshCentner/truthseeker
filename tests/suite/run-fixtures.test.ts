import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluate, aggregate } from '../../src/index.js';
import type { FixtureCase } from '../fixtures/helpers.js';
import type { Band, TreeId, Verdict } from '../../src/schema/ledger.js';

const casesDir = fileURLToPath(new URL('../fixtures/cases/', import.meta.url));

async function loadCases(): Promise<FixtureCase[]> {
  const files = readdirSync(casesDir).filter((f) => f.endsWith('.ts'));
  const cases: FixtureCase[] = [];
  for (const file of files) {
    const mod = (await import(path.join(casesDir, file))) as { case_: FixtureCase };
    cases.push(mod.case_);
  }
  return cases;
}

function run(fixture: FixtureCase): Verdict {
  return fixture.kind === 'evaluate' ? evaluate(fixture.input) : aggregate(fixture.input, fixture.previous);
}

const cases = await loadCases();

describe('fixture suite (FR-047-FR-051, SC-002, SC-003, SC-008)', () => {
  it('has at least one case', () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  for (const fixture of cases) {
    it(`${fixture.id} (${fixture.protocolClause})`, () => {
      const verdict = run(fixture);
      // FR-050: a failing case names the case id, expected band, actual band,
      // and (via the custom message) the fields that diverged.
      expect(verdict.band, `[${fixture.id}] expected band ${fixture.expected.band}, got ${verdict.band}`).toBe(
        fixture.expected.band,
      );
      expect(verdict.tree, `[${fixture.id}] expected tree ${fixture.expected.tree}, got ${verdict.tree}`).toBe(
        fixture.expected.tree,
      );
      if (fixture.expected.qualifier !== undefined) {
        expect(
          verdict.qualifier,
          `[${fixture.id}] expected qualifier ${fixture.expected.qualifier}, got ${verdict.qualifier}`,
        ).toBe(fixture.expected.qualifier);
      }
      if (fixture.expected.movedBy !== undefined) {
        expect(
          verdict.movedBy,
          `[${fixture.id}] expected movedBy ${fixture.expected.movedBy}, got ${verdict.movedBy}`,
        ).toBe(fixture.expected.movedBy);
      }
      expect(verdict.refusalReason, `[${fixture.id}] unexpected refusal: ${verdict.refusalReason}`).toBe(null);
    });
  }

  it('SC-006: no verdict contains a numeric score anywhere', () => {
    for (const fixture of cases) {
      const verdict = run(fixture);
      for (const v of Object.values(verdict)) {
        expect(typeof v === 'number' ? `${fixture.id}:${v}` : 'ok').not.toMatch(/^.+:.+$/);
      }
    }
  });

  it('FR-006/SC-004: identical input produces byte-identical output', () => {
    for (const fixture of cases) {
      const a = JSON.stringify(run(fixture));
      const b = JSON.stringify(run(fixture));
      expect(a, `[${fixture.id}] two calls with the same input diverged`).toBe(b);
    }
  });

  it('SC-003: every implemented tree has at least one fixture per band it can currently reach', () => {
    const seen = new Map<TreeId, Set<Band | null>>();
    for (const fixture of cases) {
      const bands = seen.get(fixture.expected.tree) ?? new Set<Band | null>();
      bands.add(fixture.expected.band);
      seen.set(fixture.expected.tree, bands);
    }
    const expectations: Record<string, Band[]> = {
      tree1_simple_factual: ['established', 'probable', 'contested', 'unsupported', 'refuted'],
      tree2_causal: ['contested', 'doubtful'],
      tree3_predictive: ['probable'],
      tree4_complex_system: ['unresolvable'],
      aggregation: ['contested', 'probable', 'unresolvable'],
      screen: ['unfalsifiable'],
    };
    for (const [tree, bands] of Object.entries(expectations)) {
      for (const b of bands) {
        expect(seen.get(tree as TreeId)?.has(b), `${tree} band '${b}' has no fixture case exercising it`).toBe(true);
      }
    }
  });
});
