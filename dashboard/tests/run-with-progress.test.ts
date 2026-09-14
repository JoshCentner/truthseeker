import { describe, it, expect } from 'vitest';
import { runWithProgress } from '../run-with-progress.js';
import { MockLlmClient, LlmAuthError } from '../../src-pipeline/index.js';

describe('runWithProgress', () => {
  it('emits a progress event per step and returns the completed result', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ outcome: 'reject', rule: 'test rule' }) } }]);
    const steps: string[] = [];
    const result = await runWithProgress('some claim', 'unused-with-injected-llm', (s) => steps.push(s), () => false, { llm });
    expect('kind' in result && result.kind === 'rejected').toBe(true);
    expect(steps).toEqual(['harm-gate']);
  });

  it('stops making further LLM calls once aborted() returns true', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ outcome: 'accept' }) } },
      { generate: { text: JSON.stringify({ primary: 'simple_factual', confidence: 'high', isExtraordinary: false }) } },
    ]);
    let stepCount = 0;
    const result = await runWithProgress(
      'some claim',
      'unused-with-injected-llm',
      () => {
        stepCount++;
      },
      () => stepCount >= 1, // abort right after the first step's progress fires
      { llm },
    );
    expect(result).toEqual({ aborted: true });
    // Only the harm-gate's own LLM call should have happened before aborting.
    expect(llm.receivedPrompts.length).toBe(1);
  });

  it('maps an LlmAuthError to an auth_failed result', async () => {
    const llm = new MockLlmClient([{ throwAuthError: true }]);
    const result = await runWithProgress('some claim', 'unused', () => {}, () => false, { llm });
    expect('kind' in result && result.kind === 'auth_failed').toBe(true);
  });
});
