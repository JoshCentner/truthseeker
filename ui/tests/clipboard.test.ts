// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { copyVerdictToClipboard, mountCopyButton } from '../clipboard.js';
import type { Verdict } from '../../src/index.js';

const sampleVerdict: Verdict = {
  band: 'established',
  qualifier: null,
  tree: 'tree1_simple_factual',
  conditionsMet: [],
  cappingConditions: [],
  engineVersion: '0.1.0',
  schemaVersion: '0.1.0',
  dependenceMap: null,
  residue: null,
  movedBy: null,
  refusalReason: null,
};

describe('clipboard', () => {
  it('writes the verdict as pretty JSON to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const ok = await copyVerdictToClipboard(sampleVerdict);
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(sampleVerdict, null, 2));
  });

  it('mountCopyButton does nothing when there is no verdict yet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const container = document.createElement('div');
    mountCopyButton(container, () => null);
    const btn = container.querySelector('button') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });
});
