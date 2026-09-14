# Phase 0 Research: Claim Dashboard

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1. Plain Node `http`, not a web framework

**Decision**: `dashboard/server.ts` uses Node's built-in `http.createServer`, with two routes
handled by a simple `if (req.url === ...)` dispatch — no Express, Fastify, or similar.

**Rationale**: The entire server surface is one POST route that streams a response. A framework
exists to manage routing complexity, middleware chains, and body-parsing convenience this feature
doesn't have enough surface area to need — matching `003`'s own reasoning for using plain `fetch`
over an HTTP client library, and `002`'s reasoning for skipping a UI framework.

**Alternatives considered**: Express — the most common choice, but adds a dependency and a
routing abstraction for two routes that don't need one.

## 2. Extending `003`'s `RunOptions` with an optional progress callback

**Decision**: `003`'s `RunOptions` gains one new optional field:
`onProgress?: (step: string) => void`. `run-pipeline.ts`'s existing `stamp()` helper calls it
immediately after recording each step, with no other change to `003`'s control flow.

**Rationale**: `003`'s trace already names every step as it happens (`stamp()`) — the only thing
missing for live progress is a way to observe that in real time rather than only after the whole
run finishes and returns. A single optional callback is the smallest possible extension: it
changes nothing for `003`'s existing callers (the CLI, `index.test.ts`, etc.), who simply never
pass it, and it needs no new module or return-type change.

**Alternatives considered**: Having the dashboard re-implement its own step sequence by calling
`003`'s individual functions (`runHarmGate`, `classifyClaim`, etc.) directly instead of
`runPipeline()` — this would duplicate `run-pipeline.ts`'s entire orchestration logic in a second
place, exactly the kind of drift risk `003`'s own `remediate()` consolidation was built to avoid.
An event-emitter-based API instead of a plain callback — more flexible, but this feature only
ever needs one listener per run, so a callback is simpler with no capability lost.

## 3. Fetch + manual SSE parsing on the client, not the native `EventSource`

**Decision**: `dashboard-client.ts` submits the claim/key via `fetch()` with a `POST` body, then
reads the response as a stream (`response.body.getReader()`), manually splitting on the
`event:`/`data:` SSE framing as chunks arrive.

**Rationale**: The browser's native `EventSource` API only supports `GET` requests with no body —
it cannot send the claim and key in the initial request at all. Since this feature needs to POST
sensitive data (the key) and then receive a stream on the *same* request/response, `fetch`'s
streaming response body is the only browser-native mechanism that supports both halves in one
round trip.

**Alternatives considered**: `EventSource` fed by a two-step flow (POST to start a run and get an
id, then `GET /api/run/:id/stream` to watch it) — works around `EventSource`'s GET-only
limitation, but requires the server to track an in-flight run by id across two separate
connections, which is exactly the kind of session state spec.md's Assumptions (no persistence, no
resume) argue against introducing for this feature. WebSockets — full duplex, more capability than
this feature needs (the client never sends anything after the initial request).

## 4. Abort the run if the connection drops

**Decision**: `server.ts` listens for the request's `close`/`aborted` event and, if it fires before
the run has produced a final result, calls an `AbortController` that `run-with-progress.ts` checks
between steps to stop calling further pipeline steps.

**Rationale**: With no persistence (spec.md Assumptions), a run nobody can observe anymore isn't
recoverable — continuing to spend the visitor's own API budget on a result nobody will ever see is
worse than stopping, not more helpful. This is the honest consequence of the no-persistence
assumption applied to a real disconnect, not a new feature being added.

**Alternatives considered**: Letting the run continue to completion in the background regardless —
would burn a disconnected visitor's API quota for a result that's simply discarded, since nothing
stores it.

## 5. Vite dev-server proxy for `/api`, one build for both entry points

**Decision**: `vite.config.ts` adds `dashboard.html` as a second entry (Vite's built-in
multi-page-app support) and a `server.proxy` rule forwarding `/api/*` requests to
`dashboard/server.ts`'s Node process during development. In production, the static build's
`/api/*` requests are served by whatever process runs `dashboard/server.ts` directly (a plan-level
detail for actually deploying this, not fixed further here — matching spec.md's own "hosting is a
separate, later decision").

**Rationale**: Keeps `002`'s existing dev workflow (`npm run dev`) intact — adding a second HTML
entry point is additive, not a rebuild of the Vite config's existing behavior. The proxy means a
developer runs the Node server and the Vite dev server side by side during development without
CORS complications, matching a very standard, well-understood pattern for this exact split.

**Alternatives considered**: Having Vite's own dev server also handle the `/api` routes via a
custom middleware plugin — avoids running two processes locally, but blurs the line between "the
static frontend" and "the Node-only server that must never expose the pipeline to a browser
bundle" (`003`'s hard constraint) — keeping them as genuinely separate processes, even in
development, is a clearer enforcement of that boundary than a shared process would be.
