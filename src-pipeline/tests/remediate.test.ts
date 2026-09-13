import { describe, it, expect } from 'vitest';
import { remediate } from '../remediate.js';
import { MockLlmClient } from '../llm-client.js';

interface Parsed {
  value: string;
}

function validate(raw: unknown): { ok: true; value: Parsed } | { ok: false; violation: string } {
  if (typeof raw === 'object' && raw !== null && typeof (raw as Parsed).value === 'string') {
    return { ok: true, value: raw as Parsed };
  }
  return { ok: false, violation: 'missing required string field "value"' };
}

describe('remediate() (FR-040, FR-041, FR-042, FR-043)', () => {
  it('succeeds on attempt 1 with no retry', async () => {
    const llm = new MockLlmClient([{ generate: { text: JSON.stringify({ value: 'ok' }) } }]);
    const result = await remediate('test-step', llm, () => 'prompt', validate);
    expect(result.ok).toBe(true);
    expect(result.attempts.length).toBe(1);
    expect(result.attempts[0]).toEqual({ step: 'test-step', attemptNumber: 1, violation: null, succeeded: true });
  });

  it('fails attempt 1, succeeds attempt 2, with the violation quoted back into the retry prompt', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ wrongField: 'x' }) } },
      { generate: { text: JSON.stringify({ value: 'ok' }) } },
    ]);
    const promptsSeen: (string | undefined)[] = [];
    const result = await remediate(
      'test-step',
      llm,
      (violation) => {
        promptsSeen.push(violation);
        return `prompt${violation ? ` (fix: ${violation})` : ''}`;
      },
      validate,
    );
    expect(result.ok).toBe(true);
    expect(result.attempts.length).toBe(2);
    expect(result.attempts[0]!.succeeded).toBe(false);
    expect(result.attempts[0]!.violation).toContain('missing required string field');
    expect(result.attempts[1]!.succeeded).toBe(true);
    // The second prompt build call MUST have received the actual violation text.
    expect(promptsSeen[1]).toContain('missing required string field');
    expect(llm.receivedPrompts[1]).toContain('missing required string field');
  });

  it('fails every attempt up to the limit and returns ok:false with every attempt recorded', async () => {
    const llm = new MockLlmClient([
      { generate: { text: JSON.stringify({ wrongField: 1 }) } },
      { generate: { text: JSON.stringify({ wrongField: 2 }) } },
      { generate: { text: JSON.stringify({ wrongField: 3 }) } },
    ]);
    const result = await remediate('test-step', llm, () => 'prompt', validate, 2); // maxAttempts=2 -> 3 total calls
    expect(result.ok).toBe(false);
    expect(result.attempts.length).toBe(3);
    expect(result.attempts.every((a) => !a.succeeded)).toBe(true);
    expect(result.attempts.map((a) => a.attemptNumber)).toEqual([1, 2, 3]);
  });

  it('treats invalid JSON itself as a violation, quoted back specifically', async () => {
    const llm = new MockLlmClient([
      { generate: { text: 'not json at all' } },
      { generate: { text: JSON.stringify({ value: 'ok' }) } },
    ]);
    const result = await remediate('test-step', llm, () => 'prompt', validate);
    expect(result.ok).toBe(true);
    expect(result.attempts[0]!.violation).toContain('not valid JSON');
  });
});
