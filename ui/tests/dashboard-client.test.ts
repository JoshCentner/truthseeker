// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { submitClaim } from '../dashboard-client.js';
import type { DashboardState } from '../dashboard-types.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('dashboard-client', () => {
  it('never calls fetch() when the key is missing (FR-004)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await submitClaim('a claim', '', () => {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never calls fetch() when the claim is missing (FR-004)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await submitClaim('', 'some-key', () => {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('updates currentStep for each progress event, in order, before the final result', async () => {
    const sseBody =
      'event: progress\ndata: {"type":"progress","step":"harm-gate"}\n\n' +
      'event: progress\ndata: {"type":"progress","step":"classify"}\n\n' +
      'event: progress\ndata: {"type":"progress","step":"search"}\n\n' +
      'event: result\ndata: {"type":"result","result":{"kind":"rejected","rule":"test"}}\n\n';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(stream, { status: 200 })),
    );

    const states: DashboardState[] = [];
    await submitClaim('a claim', 'a-key', (s) => states.push(s));

    const runningSteps = states
      .filter((s): s is Extract<DashboardState, { phase: 'running' }> => s.phase === 'running')
      .map((s) => s.currentStep);
    expect(runningSteps).toEqual(['harm-gate', 'harm-gate', 'classify', 'search']); // first is the optimistic initial state
    expect(states[states.length - 1]).toEqual({ phase: 'done', result: { kind: 'rejected', rule: 'test' } });
  });

  it('reports a connection-error state when fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const states: DashboardState[] = [];
    await submitClaim('a claim', 'a-key', (s) => states.push(s));
    expect(states[states.length - 1]).toEqual({ phase: 'connection-error', message: 'network down' });
  });
});
