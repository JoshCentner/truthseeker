import { describe, it, expect } from 'vitest';
import { generateRivals } from '../rivals.js';
import { MockLlmClient } from '../llm-client.js';

describe('rivals (FR-028, FR-029)', () => {
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
    const rivals = await generateRivals('X causes Y', llm);
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
    const rivals = await generateRivals('some claim', llm);
    expect(rivals.map((r) => r.id)).toEqual(['rival-0', 'rival-1']);
    expect(rivals[0]!.plausibilityRelativeToClaim).toBe('more_plausible');
  });

  it('never sends anything to the LLM that could be mistaken for a grading call (no rubric text)', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ rivals: [] }) } }]);
    await generateRivals('some claim', llm);
    expect(llm.receivedPrompts[0]).not.toContain('Primary warrant hierarchy');
  });
});
