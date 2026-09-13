import { expect } from 'vitest';
import type { RemediationResult } from '../remediate.js';

/** Asserts a RemediationResult succeeded and returns its value — used across
 * test files so each one doesn't repeat the same ok-check boilerplate. */
export function unwrapOk<T>(result: RemediationResult<T>): T {
  expect(result.ok, `expected ok:true, got ok:false with attempts: ${JSON.stringify('attempts' in result ? result.attempts : [])}`).toBe(true);
  if (!result.ok) throw new Error('unreachable — assertion above already failed');
  return result.value;
}
