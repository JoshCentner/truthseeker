# Phase 1 Data Model: Claim Dashboard

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This feature declares no domain types of its own — `PipelineResult`, `RunOptions`, and everything
inside a completed `LedgerInput`/`Verdict` are `003`'s and `001`'s already-shipped types, imported
directly (Constitution Principle IV: this feature adapts to that schema, it doesn't fork it).
What follows is the transport shape between the browser and the server.

## RunOptions extension (research.md §2)

```ts
// In src-pipeline/types.ts (003) — additive, optional, no existing caller affected
interface RunOptions {
  requester?: string;
  modelId?: string;
  onProgress?: (step: string) => void; // new
}
```

## RunRequest (client → server, the POST body)

```ts
interface RunRequest {
  claim: string;
  apiKey: string;
  requester?: string;
}
```

Never logged or stored by `server.ts` — it exists only as a local variable inside the request
handler's closure for the duration of that one connection (FR-003).

## Server-Sent Event framing (server → client, over the same connection)

Two event types, both JSON-encoded in the SSE `data:` field:

```ts
type ServerEvent =
  | { type: 'progress'; step: string }
  | { type: 'result'; result: PipelineResult }; // PipelineResult imported from 003
```

Wire format (research.md §3 — manually parsed, not native `EventSource`):

```text
event: progress
data: {"type":"progress","step":"grade"}

event: result
data: {"type":"result","result":{"kind":"completed", ...}}

```

Exactly one `result` event ends every stream, whatever `PipelineResult.kind` turns out to be —
the client's parser doesn't need a separate "stream closed unexpectedly" case for the four normal
outcomes, only for a genuine connection failure (dashboard-client.ts's own error handling, not a
`ServerEvent` variant).

## Dashboard display state (client-side only)

```ts
type DashboardState =
  | { phase: 'idle' }
  | { phase: 'running'; currentStep: string }
  | { phase: 'done'; result: PipelineResult }
  | { phase: 'connection-error'; message: string };
```

`dashboard-display.ts` renders each `PipelineResult.kind` inside the `'done'` phase differently
(FR-002): `completed` as the full readable verdict (FR-007), `rejected`/`needs_review`/
`needs_clarification` each with their own specific messaging (FR-008-010). `'connection-error'` is
distinct from all four — it means the dashboard itself never received a final answer, not that
`003` returned one saying something went wrong.

## State flow

```text
Visitor fills in claim + key, submits
  -> dashboard-client.ts: fetch POST /api/run, body: RunRequest
  -> server.ts: request handler holds { claim, apiKey } in closure only
       -> run-with-progress.ts: runPipeline(claim, apiKey, { onProgress: emit }) [003, unmodified]
            -> each step -> onProgress(step) -> server writes an SSE 'progress' event
       -> runPipeline resolves -> server writes the SSE 'result' event -> closes the connection
  -> dashboard-client.ts: reads the stream, updates DashboardState as each event arrives
  -> dashboard-display.ts: renders the current DashboardState
```

If the connection drops before the `result` event (research.md §4), `server.ts`'s abort path stops
calling further pipeline steps; the client never receives a `result` event and its own `fetch`
call rejects or the stream closes early, which `dashboard-client.ts` maps to
`{ phase: 'connection-error' }`.
