import { describe, it, expect } from 'vitest';
import { generateRivals } from '../rivals.js';
import { MockLlmClient } from '../llm-client.js';
import { unwrapOk } from './test-helpers.js';

describe('rivals (FR-028, FR-029, FR-045)', () => {
  it('proposes at least one rival distinct from the claim itself', async () => {
    const llm = new MockLlmClient([
      {
        generate: {
          text: JSON.stringify({
            rivals: [{ description: 'The observed effect is due to a confounding variable, not the claimed cause', plausibilityRelativeToClaim: 'less_or_equally_plausible' }],
          }),
        },
      },
    ]);
    const rivals = unwrapOk(await generateRivals('X causes Y', llm));
    expect(rivals.length).toBeGreaterThanOrEqual(1);
    expect(rivals[0]!.description).not.toBe('X causes Y');
  });

  it('assigns each rival a stable id and preserves plausibility judgment', async () => {
    const llm = new MockLlmClient([
      {
        generate: {
          text: JSON.stringify({
            rivals: [
              { description: 'Rival A', plausibilityRelativeToClaim: 'more_plausible' },
              { description: 'Rival B', plausibilityRelativeToClaim: 'less_or_equally_plausible' },
            ],
          }),
        },
      },
    ]);
    const rivals = unwrapOk(await generateRivals('some claim', llm));
    expect(rivals.map((r) => r.id)).toEqual(['rival-0', 'rival-1']);
    expect(rivals[0]!.plausibilityRelativeToClaim).toBe('more_plausible');
  });

  it('never sends anything to the LLM that could be mistaken for a grading call (no rubric text)', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ rivals: [{ description: 'a rival', plausibilityRelativeToClaim: 'less_or_equally_plausible' }] }) } },
    ]);
    await generateRivals('some claim', llm);
    expect(llm.receivedPrompts[0]).not.toContain('Primary warrant hierarchy');
  });

  it('an empty rivals array is a validation failure (FR-028 requires at least one), not a silently accepted result', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ rivals: [] }) } },
      { generate: { text: JSON.stringify({ rivals: [{ description: 'a real rival', plausibilityRelativeToClaim: 'less_or_equally_plausible' }] }) } },
    ]);
    const rivals = unwrapOk(await generateRivals('some claim', llm));
    expect(rivals.length).toBe(1);
    expect(llm.receivedPrompts[1]).toContain('at least one rival');
  });
});
