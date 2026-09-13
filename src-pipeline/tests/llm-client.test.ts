import { describe, it, expect } from 'vitest';
import { translateError, LlmAuthError } from '../llm-client.js';

describe('translateError (FR-010)', () => {
  it.each([
    'API key not valid',
    'Request had invalid authentication credentials (401)',
    'PERMISSION_DENIED (403): caller does not have permission',
    'Unauthorized',
  ])('classifies "%s" as an LlmAuthError', (message) => {
    const result = translateError(new Error(message));
    expect(result).toBeInstanceOf(LlmAuthError);
  });

  it('does not classify an unrelated failure as an auth error', () => {
    const result = translateError(new Error('rate limit exceeded, try again later'));
    expect(result).not.toBeInstanceOf(LlmAuthError);
  });

  it('does not classify a network failure as an auth error', () => {
    const result = translateError(new Error('fetch failed: getaddrinfo ENOTFOUND generativelanguage.googleapis.com'));
    expect(result).not.toBeInstanceOf(LlmAuthError);
  });
});
