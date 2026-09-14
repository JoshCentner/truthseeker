import type { ServerResponse } from 'node:http';
import type { ServerEvent } from './types.js';

/** Sets the headers a streaming SSE response needs, once, before any event is written. */
export function startEventStream(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
}

/** data-model.md's exact wire format: `event: <type>\ndata: <json>\n\n`. */
export function writeEvent(res: ServerResponse, event: ServerEvent): void {
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
