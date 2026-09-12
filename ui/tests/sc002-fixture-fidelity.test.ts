// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { getFixtureEntries, draftFromEntry } from '../fixture-library.js';
import { run } from '../engine-bridge.js';

describe('SC-002: every fixture reproduces its expected verdict through the real UI pipeline', () => {
  it('discovers every real fixture file, not a subset', () => {
    const casesDir = path.join(process.cwd(), 'tests/fixtures/cases');
    const realCount = readdirSync(casesDir).filter((f) => f.endsWith('.ts')).length;
    expect(getFixtureEntries().length).toBe(realCount);
  });

  it('reproduces band/qualifier/tree/movedBy for every fixture, end to end', () => {
    const entries = getFixtureEntries();
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const draft = draftFromEntry(entry);
      const result = run(draft);
      const expected = entry.case_.expected;

      expect(result.kind, `[${entry.id}] unexpected non-verdict result: ${JSON.stringify(result)}`).toBe('verdict');
      if (result.kind !== 'verdict') continue;

      expect(result.verdict.band, `[${entry.id}] band mismatch`).toBe(expected.band);
      expect(result.verdict.tree, `[${entry.id}] tree mismatch`).toBe(expected.tree);
      if (expected.qualifier !== undefined) {
        expect(result.verdict.qualifier, `[${entry.id}] qualifier mismatch`).toBe(expected.qualifier);
      }
      if (expected.movedBy !== undefined) {
        expect(result.verdict.movedBy, `[${entry.id}] movedBy mismatch`).toBe(expected.movedBy);
      }
    }
  });
});
