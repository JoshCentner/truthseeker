# Contract: Dashboard HTTP API

**Feature**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

This is the only surface a caller outside `dashboard/` may depend on — in practice, the
`ui/dashboard-*.ts` frontend, but documented independently since it's a real network boundary.

## `POST /api/run`

**Request body** (`application/json`): a `RunRequest` (data-model.md) — `{ claim, apiKey,
requester? }`.

**Response**: `text/event-stream`, chunked. One or more `progress` events, followed by exactly one
`result` event, then the connection closes. See data-model.md for the exact `ServerEvent` framing.

**Behavior**:
- Runs `003`'s `runPipeline(claim, apiKey, { requester, onProgress })` unmodified — this endpoint
  performs no harm-gate, grading, or banding logic of its own.
- The parsed `apiKey` from the request body exists only inside this request handler's closure; it
  is never written to a variable outside that scope, a log line, or any file (FR-003).
- If the client disconnects before the `result` event is sent, the server aborts the in-flight
  `runPipeline()` call (research.md §4) rather than letting it run to completion unobserved.
- Never returns a `4xx`/`5xx` for a normal pipeline outcome (rejection, needs_review,
  needs_clarification, auth_failed are all valid `result` events, not HTTP errors) — a non-2xx
  status is reserved for a malformed request body (missing `claim` or `apiKey`) or a genuine
  server fault before `runPipeline` was ever called.

**Concurrency**: each request is handled independently with no shared state across requests
(SC-005) — there is no session, no run registry, and no way for one request's handler to observe
another's.

## Explicitly not in this contract

- Any endpoint for resuming or continuing a `needs_clarification` run — out of scope per the
  accepted clarification (spec.md); a visitor always submits a fresh `POST /api/run`.
- Any authentication of the *visitor* (as opposed to the API key they supply for `003`) — this
  feature has no visitor accounts.
- A GET endpoint for reconnecting to an in-progress run — research.md §3 explicitly chose the
  single-connection model specifically to avoid needing one.
