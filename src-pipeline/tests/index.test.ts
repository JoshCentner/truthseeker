import { describe, it, expect } from 'vitest';
import { runPipeline } from '../index.js';

describe('BYOK (FR-007-010)', () => {
  it('throws for an empty apiKey — a programmer error, not a normal PipelineResult', async () => {
    await expect(runPipeline('some claim', '')).rejects.toThrow(/non-empty apiKey/);
  });

  it('throws for a missing apiKey argument', async () => {
    // @ts-expect-error deliberately omitting the required argument to prove it's enforced at the type level too
    await expect(runPipeline('some claim')).rejects.toThrow();
  });
});
