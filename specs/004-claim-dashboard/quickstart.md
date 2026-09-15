# Quickstart: Claim Dashboard

**Feature**: [spec.md](./spec.md) | **Contract**: [contracts/dashboard-api.md](./contracts/dashboard-api.md)

Like `003`, this feature's automated tests use `MockLlmClient` throughout — no key or network
access needed to validate the server's request handling, progress streaming, or the client's
rendering logic. A real end-to-end run (does the whole thing actually work with Gemini) needs a
human with a real key.

## Part 1: automated validation (no key needed)

```bash
npm install
npm test
```

**Expected**: `dashboard/tests/*.test.ts` and `ui/tests/dashboard-*.test.ts` all pass. This proves:

**A note on offline verification**: unlike `001`/`002`/`003`'s pure-function tests,
`dashboard/tests/server.test.ts` makes real HTTP requests over loopback to test the actual server
— `unshare --net` isolates loopback too (the same lesson `002`'s own quickstart.md already
records), so it isn't the right tool to verify "no external network calls" here. The correct check
is static: `grep -rn "fetch(\|http.request\|https.request\|XMLHttpRequest" dashboard/*.ts` and the
same across `ui/dashboard-*.ts` for a hardcoded external URL — both return zero matches. The only
network activity anywhere in this feature's own code is same-origin (`/api/run`) and whatever
`003`'s injected `LlmClient` does, which every automated test replaces with `MockLlmClient`.
- `POST /api/run` streams `progress` events as `003`'s orchestrator advances, then exactly one
  `result` event.
- The supplied `apiKey` string never appears in any log output or file the server touches (SC-002)
  — a grep-based check, the same pattern `003`'s `key-isolation.test.ts` already established.
- A disconnect mid-run stops further mock LLM calls (research.md §4) — the mock's call count after
  an aborted request is lower than a completed run's.
- Two concurrent mock requests never see each other's claim or progress (SC-005).
- Each of `003`'s four `PipelineResult.kind` values renders through `dashboard-display.ts` in a
  visibly distinct way (SC-001) — checked the same way `002`'s `verdict-display.test.ts` checks
  its own render states.

## Part 2: live validation (needs your own Gemini API key)

```bash
# Terminal 1
node --import tsx dashboard/server.ts
# Terminal 2
npm run dev
```

Open the dashboard page in a browser, submit a real claim with your key.

**Expected**: progress updates appear as the run advances, and a final result renders — a
completed verdict as readable prose and an evidence list, or the specific rejection/review/
clarification messaging otherwise. Try closing the browser tab mid-run and check the server's own
console — it should show the run being aborted, not continuing silently to completion.

## Troubleshooting

- **Progress never updates past the first step**: check the Node server process is actually
  running and the Vite dev-server proxy (`vite.config.ts`) is pointed at its port.
- **The key appears in a network request you can see other than the initial POST**: this would be
  a real bug against FR-003 — the key should never appear in any request after the first.
