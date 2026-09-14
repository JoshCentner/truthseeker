import type { DashboardState } from './dashboard-types.js';
import type { ServerEvent } from '../dashboard/types.js';

/**
 * research.md §3: the native EventSource API can't POST a body, so this
 * reads the fetch() response as a stream and manually splits on the SSE
 * `event:`/`data:` framing as chunks arrive, rather than waiting for the
 * whole response to buffer.
 */
function parseSseChunk(buffer: string): { events: ServerEvent[]; rest: string } {
  const events: ServerEvent[] = [];
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? ''; // the last, possibly-incomplete block is carried forward
  for (const block of blocks) {
    const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
    if (dataLine) {
      events.push(JSON.parse(dataLine.slice('data: '.length)) as ServerEvent);
    }
  }
  return { events, rest };
}

export async function submitClaim(
  claim: string,
  apiKey: string,
  onState: (state: DashboardState) => void,
): Promise<void> {
  // FR-004: never attempted without a key.
  if (!claim || !apiKey) {
    return;
  }

  onState({ phase: 'running', currentStep: 'harm-gate' });

  let response: Response;
  try {
    response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim, apiKey }),
    });
  } catch (err) {
    onState({ phase: 'connection-error', message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!response.ok || !response.body) {
    onState({ phase: 'connection-error', message: `server responded with status ${response.status}` });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let gotResult = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseChunk(buffer);
      buffer = rest;
      for (const event of events) {
        if (event.type === 'progress') {
          onState({ phase: 'running', currentStep: event.step });
        } else {
          gotResult = true;
          onState({ phase: 'done', result: event.result });
        }
      }
    }
  } catch (err) {
    if (!gotResult) {
      onState({ phase: 'connection-error', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  if (!gotResult) {
    onState({ phase: 'connection-error', message: 'connection closed before a result was received' });
  }
}
