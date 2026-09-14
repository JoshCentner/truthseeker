import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { runWithProgress } from './run-with-progress.js';
import { startEventStream, writeEvent } from './sse.js';
import type { RunRequest } from './types.js';
import type { LlmClient } from '../src-pipeline/index.js';

const PORT = Number(process.env.DASHBOARD_SERVER_PORT ?? 3001);

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * FR-001, FR-002: runs 003's pipeline unmodified and streams every outcome
 * back over one connection. FR-003: `apiKey` is parsed into a local variable
 * inside this function and never assigned anywhere else — no module-level
 * variable, no log call, no file write anywhere in this handler references
 * it.
 */
async function handleRun(req: IncomingMessage, res: ServerResponse, llm?: LlmClient): Promise<void> {
  const bodyText = await readBody(req);

  let parsed: Partial<RunRequest>;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'request body must be valid JSON' }));
    return;
  }

  // FR-004: a key is required before any run starts; never a fallback key.
  if (!parsed.claim || !parsed.apiKey) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'both "claim" and "apiKey" are required' }));
    return;
  }
  const { claim, apiKey, requester } = parsed as RunRequest;

  startEventStream(res);

  // research.md §4: aborts the in-flight run if the client disconnects
  // before a result is ready, rather than letting it run to completion
  // unobserved and unstored.
  let clientAborted = false;
  req.on('close', () => {
    clientAborted = true;
  });

  const result = await runWithProgress(
    claim,
    apiKey,
    (step) => writeEvent(res, { type: 'progress', step }),
    () => clientAborted,
    { requester, llm },
  );

  if ('aborted' in result) {
    // The client is already gone — nothing to write or observe.
    res.end();
    return;
  }

  writeEvent(res, { type: 'result', result });
  res.end();
}

export function createDashboardServer(options: { llm?: LlmClient } = {}) {
  return createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/run') {
      handleRun(req, res, options.llm).catch((err) => {
        // A genuine server fault before/during handling — distinct from any
        // normal PipelineResult, all of which are valid `result` events, not
        // HTTP errors (contracts/dashboard-api.md).
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        } else {
          res.end();
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createDashboardServer().listen(PORT, () => {
    console.log(`Dashboard server listening on http://localhost:${PORT}`);
  });
}
