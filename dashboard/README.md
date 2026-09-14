# Claim Dashboard

A small Node server that safely brokers a visitor's claim and API key into
[`003`'s judgment pipeline](../src-pipeline/README.md), streaming live progress and the final
result to a browser dashboard over one HTTP connection. Full design in
[`specs/004-claim-dashboard/`](../specs/004-claim-dashboard/).

## Running it

```bash
# Terminal 1 — the server that actually talks to 003's pipeline
npm run dashboard:server

# Terminal 2 — the frontend dev server (proxies /api to the server above)
npm run dev
```

Open the printed dev-server URL's `/dashboard.html` page. Submit a claim with your own API key —
never the server operator's; there is no fallback key anywhere in this feature.

## Why a server at all

`003` established a hard rule: the pipeline's API key must never reach a browser context, since
anything shipped in browser JavaScript is visible to anyone who opens devtools. This feature's
whole server exists to hold that boundary — the browser never imports `003`'s pipeline or
`@google/genai` directly; it only ever talks to `dashboard/server.ts` over `/api/run`.

## The four outcomes

Every submission ends in exactly one of `003`'s four `PipelineResult` kinds, each rendered
distinctly by `ui/dashboard-display.ts`:

| Outcome | What it means | Shown as |
|---|---|---|
| `completed` | A real verdict was computed | Band, evidence list (each source's URL, grade, and relationship to the claim), plain-language capping conditions |
| `rejected` | The harm gate said this claim is out of scope | The specific rule that fired |
| `needs_review` | Genuinely borderline — a human policy call | The reason, distinct from a mechanical failure |
| `needs_clarification` | A step couldn't produce valid output after retrying | The specific unresolved question(s) — resubmit with that information included |

`needs_clarification` always requires a fresh submission in this version — see
`PROJECT-TRACKER.md` for the deferred interactive-resume capability.

## Testing

Like `003`, every automated test uses `MockLlmClient` — no key or network access needed.
`dashboard/tests/server.test.ts` makes real HTTP requests over loopback to test the actual server
(the one thing in this repo that isn't a pure function call), which is why offline verification
for this feature is a static check (`quickstart.md`), not `unshare --net`.

## Contract

[`specs/004-claim-dashboard/contracts/dashboard-api.md`](../specs/004-claim-dashboard/contracts/dashboard-api.md)
documents `POST /api/run` fully — the only endpoint this feature exposes.
