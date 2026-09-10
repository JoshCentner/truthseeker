# GroundTruth Execution Platform — Project Brief (working title, v0.1)

Status: pre-repo scoping doc. Written from a voice-dictated brief on 2026-09-09. Awaiting GitHub repo.

## 1. What this is

A third project, distinct from **theMap** and the **GroundTruth methodology/site**. Those two produced *the method* (the seven-step evidence pipeline, the AGENT-PROTOCOL-v3.md prompt) and *a hand-written case study* (theMap's Israel-Palestine analysis). This project is the **runtime**: a public app that takes any claim, executes the GroundTruth protocol against it as a multi-agent, tool-using pipeline, and returns a versioned, visualized, fully-traced verdict — instead of requiring a user to know how to paste a prompt into a chat window.

| | theMap | GroundTruth (site/method) | This platform |
|---|---|---|---|
| Identity | Anonymous | Josh's real name | TBD (see §6.1) |
| Output | One hand-curated 62-page site | The method itself (spec, docs) | Live app, many claims, on demand |
| Audience | Public readers of one topic | Expert reviewers, then public | Any user, any claim |
| Hosting | Cloudflare Workers | Netlify | TBD |

## 2. Problem it solves

- The AGENT-PROTOCOL prompt only works in chat today — text-only output, and most people don't know how to use a raw prompt correctly.
- Running the full pipeline per-query is slow and expensive (multiple research + judging passes).
- There's no shared, reusable record: every user re-runs the same claim from scratch.
- No transparency layer: even when it works, you can't *see* the agent reasoning or verify how it reached a verdict.
- Broader mission: society lost a trusted "look it up here" reference point (encyclopedia → Wikipedia → now contested). This is a bid at a transparent, contestable, evolving replacement mechanism — not a final authority, but a method everyone can inspect and argue with on its own terms.

## 3. Core user flow (as described)

1. User opens the app, types a claim in an input box (e.g. "vaccines cause autism").
2. App checks its own database for an existing recent assessment of that claim or a close match.
   - If found: serve the existing report, labeled with its original run date ("Reusing existing assessment from [date]").
   - User can optionally force a fresh re-run (Phase 2 capability, not MVP).
   - If not found: run the pipeline fresh.
3. Pipeline execution:
   - Runs the GroundTruth seven-step protocol (research, sourcing, grading, independence-counting, missing-evidence search, rival explanations, adversarial-test check).
   - One or more **judge agents** review the output of each step (or specialize by step type), rather than the pipeline self-grading.
   - Every action is logged: what was searched, what was fetched, what each agent concluded and why — a full trace, not just a final answer.
4. Output to the user:
   - A score/band against the five-to-eight confidence bands (Established / Probable / Contested / Doubtful / Refuted / Unsupported / Unfalsifiable / Unresolvable, per the v3 spec).
   - Arguments for and against, visualized (multiple views — exact formats TBD, see §5).
   - A reviewable trace: how the system did its research and reached the verdict, for anyone auditing the result.
5. Everything — reports and traces — stored so future queries reuse rather than re-run.

## 4. System components (draft)

- **Frontend**: single input box → results view. Needs at least two views: (a) plain verdict + for/against visualization for a casual reader, (b) full trace view for someone auditing.
- **Claim-matching layer**: before running anything, checks whether an existing report answers this claim or a near-duplicate. This is a semantic-similarity problem, not exact string match — "vaccines cause autism" and "does the MMR vaccine cause autism" need to hit the same cached report. Non-trivial; flagged as a build risk in §7.
- **Orchestrator**: runs the seven-step pipeline as a sequence of agent calls with tool access (search, fetch).
- **Judge layer**: separate agent(s) reviewing pipeline output, either one generalist judge or several specialists by step type (sourcing judge, independence-counting judge, etc. — mirrors how you already split concerns in the v3 spec's decision trees).
- **Trace store**: structured log of every tool call, every intermediate agent output, every judge ruling — persisted per report, not just the final answer.
- **Report store**: the versioned, cached verdicts themselves, keyed by normalized/matched claim, with timestamp and "supersede" links when a claim is re-run.
- **Rate limiting / cost control layer**: see §6.1 — architecture depends on the BYOK decision.
- **Visualization layer**: renders the trace and the for/against case in an inspectable form (this is a strong fit for diagrams/interactive widgets — worth designing as its own subsystem rather than bolting on later).

## 5. Visualization requirements

You asked for the output to be "visualized in a way that is very easy to understand, in multiple different ways." Read as two distinct visualization needs, not one:

1. **Verdict view** (for the asker): claim → band → for/against arguments, weighted by evidence grade. This is the "fun app" surface.
2. **Process view** (for the auditor): the trace — which agent did what, which sources were pulled, where each judge intervened and why. This is the transparency/trust surface, and arguably the more important one given the mission (a wrong verdict people can audit is more valuable than a right one they can't).

Both need to exist from MVP if the transparency claim is going to mean anything at launch — a v1 that only shows the verdict and defers the trace view to "later" undercuts the stated point of the project.

## 6. Open questions / decisions needed before build

### 6.1 Funding/access model (blocking — architectures diverge here)
Your brief contains two different models:
- **BYOK (bring your own key)**: user supplies their own API key; app is free to you regardless of volume; no throttling of *your* account is needed because it's never charged.
- **Josh-funded, rate-limited**: app uses your API key; you throttle per-user/per-day to cap your own spend.
These have different builds, different abuse surfaces, and different legal/ToS exposure (a BYOK app that runs adversarial web research on behalf of third parties using their own credentials is a different liability profile than one spending your money). Needs a decision before the orchestrator or billing layer is designed. Recommend: BYOK for MVP (zero cost/abuse exposure to you, proves the concept), with a Josh-funded "try it once free" path as a later addition once abuse controls exist.

### 6.2 Identity and hosting
theMap is anonymous; GroundTruth (method) is under your real name. Which identity does this platform run under? Given it's the execution layer for GroundTruth, real-name/GroundTruth-branded seems the natural default — but flagging it as a decision rather than assuming, since you've been deliberate about keeping identities separated for risk reasons elsewhere.

### 6.3 Claim scope and abuse surface
An open "ask it anything" claim-evaluator, cached and public, that will happily process claims like "vaccines cause autism" is also an open surface for:
- Claims about identifiable private individuals (defamation-shaped risk if the app returns a confident-sounding verdict about a person).
- Coordinated abuse: people submitting claims designed to bait a bad or embarrassing verdict, then screenshotting it.
- Prompt-injection during research: adversarial pages designed to manipulate the agent's fetch/search results.
Needs an explicit claim-scope policy (e.g., no claims naming private individuals) before public launch, not after an incident.

### 6.4 Judge agent design
"Judge agent(s)" — single generalist or a panel of specialists mirroring the pipeline's own step types? The v3 methodology already has natural seams (sourcing, independence-counting, rival-explanation search) that map to specialist judges. Worth deciding whether judges are a v1 feature or a v2 add-on once the base pipeline is proven, since a multi-judge system roughly multiplies orchestration complexity and cost.

### 6.5 Re-run staleness policy
You flagged user-triggered re-run as a future capability, correctly. For MVP, you still need *some* staleness rule (e.g., "reports older than 90 days are shown with a stronger staleness warning") even without a manual re-run button, or the cache will silently serve years-old verdicts on fast-moving topics as if they were current.

### 6.6 Open-source governance
"Anyone can contribute" needs a minimal contribution policy before it's actually open, especially given the topic sensitivity: who merges changes to the judging criteria or the claim-scope policy, and how is drift from the mirror rule prevented once other people are submitting PRs to the methodology itself (as opposed to the app code)? Worth separating "app code is open" from "methodology changes go through your review" explicitly.

## 7. Key build risks

| Risk | Why it matters | Mitigation direction |
|---|---|---|
| Claim-matching is a hard NLP problem, not string match | Bad matching either creates duplicate reports for the same claim or wrongly serves an unrelated cached report as if it answered the question | Start conservative: only auto-serve on high-confidence semantic match; otherwise treat as new and let the trace show what was compared against |
| Cost/abuse if not BYOK | A free, unauthenticated research-agent pipeline is expensive to run per-query and easy to hammer | Resolve §6.1 before any orchestrator work starts |
| Defamation-shaped verdicts on named individuals | A confident-sounding AI verdict about a real person is a different risk class than about "vaccines" | Explicit claim-scope policy pre-launch (§6.3) |
| Prompt injection via fetched pages | Adversarial pages can attempt to steer the agent's judgment mid-research | Trace/judge layer must treat fetched page content as data, not instructions — carry this rule into the agent protocol itself if it isn't already there |
| Visualization/trace work becomes an afterthought | If the trace view slips to "phase 2," the app launches as an opaque verdict machine — exactly what it's positioned against | Build a minimal trace view in MVP, even if plain and unstyled, rather than deferring |
| Multi-judge orchestration cost/latency | Several agents reviewing several steps multiplies API calls and wall-clock time per claim | Decide judge architecture (§6.4) before assuming it's in MVP |
| Open-source governance drift | Contributors could erode the mirror rule or judging criteria without a review gate | Separate app-code openness from methodology-change review (§6.6) |
| Cache staleness on fast-moving claims | A claim tied to ongoing events (e.g. a live news story) served from a 6-month-old cache reads as current | Minimum staleness warning threshold even pre-rerun-button (§6.5) |

## 8. Phased plan

### Phase 0 — Setup (once repo exists)
- [ ] Confirm identity/branding decision (§6.2)
- [ ] Confirm funding/access model (§6.1) — this gates architecture choices below
- [ ] Get full AGENT-PROTOCOL-v3.md text into this project's knowledge base
- [ ] Draft minimal claim-scope policy (§6.3)
- [ ] Repo scaffold, license choice (open-source license, not yet specified)

### Phase 1 — MVP
- [ ] Single input box → run pipeline → return verdict (no caching yet, prove the pipeline works end to end)
- [ ] Basic report store (even flat-file/JSON is fine initially) with claim, verdict, trace, timestamp
- [ ] Basic claim-matching (start conservative — exact/near-exact match only, expand later)
- [ ] Minimal trace view (plain but real — see §7 risk on this)
- [ ] Rate limiting per chosen access model
- [ ] Staleness label on served cached reports

### Phase 2 — Judges and richer visualization
- [ ] Judge agent(s) per §6.4 decision
- [ ] Multiple visualization modes for the for/against case
- [ ] Improved semantic claim-matching
- [ ] User-triggered re-run of stale claims

### Phase 3 — Open source and community
- [ ] Contribution guidelines separating app-code PRs from methodology-change review
- [ ] Public launch coordination with GroundTruth's own launch sequence (statistics professor review, expert panel, LinkedIn/TED plan) — worth sequencing so this platform doesn't launch ahead of the methodology's own validation gate

## 9. Next steps
- You create the GitHub repo; paste or link the full AGENT-PROTOCOL-v3.md into project knowledge so build work references the real spec, not this summary of it.
- Resolve §6.1 (funding model) first — it's the one decision that changes the shape of everything downstream.
- This doc should move into the repo as PLATFORM-BRIEF.md (or similar) and get a PROJECT-TRACKER.md alongside it, matching your existing session-discipline pattern from the other two projects.
