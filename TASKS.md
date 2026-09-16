# Tasks

The working backlog: reviews that need a human, features to build, refactors, and housekeeping.
Ordered by priority within each section. Last revised 2026-09-17 against HEAD `85baf24`.

How this relates to the other tracking documents:

- `PROJECT-TRACKER.md` is the **log** — where a feature deliberately deferred something, and what
  got resolved. It is the source for many items here and stays the place a spec-kit session writes
  to. This file does not replace it; it turns its Open items (plus defects found by reading the
  code) into an ordered, actionable list.
- `specs/*/tasks.md` are per-feature task lists produced by `/speckit-tasks`. Once a feature below
  is specified, its detailed tasks live there and the entry here becomes a one-line pointer.
- `.specify/memory/constitution.md` wins over everything on this page. Each entry names the
  principle it serves so a reviewer can check the claim.

Conventions:

- **ID prefixes**: `R-` review (a person decides), `F-` feature (goes through
  `/speckit-specify → clarify → plan → tasks → implement`), `RF-` refactor (no behaviour change,
  fixture suite unchanged), `H-` housekeeping.
- **Methodology** tag: touches `src/trees/`, `src/normalize/`, `src/aggregate/`, or
  `src-pipeline/registry.ts`. Needs methodology review, not just code review (constitution,
  Development Workflow). Never merged on an assistant's say-so.
- **Schema** tag: changes a stored-run field. Requires a version bump and a migration for the two
  committed runs and the manual-run transcripts (Principle IV).
- Status is `[ ]` open, `[~]` in progress (name the branch), `[x]` done (name the commit). Move
  done items to the bottom section rather than deleting them.

---

## R — Reviews (need a human decision, not more code)

These are ordered by consequence. Nothing in section F that carries the **Methodology** tag should
merge until R-01 and R-02 are settled, because they define the baseline it would be measured
against.

- [x] **R-01 · Engine 0.2.0 methodology review** — decided 2026-09-17, see Done. Build is F-16.

- [ ] **R-02 · Registry additions review** — *Methodology · Principle VI*
  `SEED_REGISTRY` gained `wikipedia.org` (all subdomains), `wikiwand.com`, `britannica.com`,
  `encyclopedia.com`, `fandom.com`, `scholar.google.com`, `researchgate.net`, `yahoo.com` as
  `aggregator` on 2026-09-17. The defence is that these are structural classes, not reliability
  grades. Reviewer should confirm each domain individually and decide:
  - whether `scholar.google.com` and `researchgate.net` are aggregators or want a distinct
    "index / mirror" class (the constitution names four classes; adding a fifth is an amendment);
  - whether `yahoo.com` is right given Yahoo Finance and Yahoo News do publish some original
    reporting (`msn.com` has the same problem and predates this batch).
  Output: each entry either confirmed, reworded, or removed; `registry_version` (F-03) bumped.

- [ ] **R-03 · FR-029 constitutional tension (spec 005)** — *Principle III*
  The displayed band on a report IS the most recent run, which Principle III's wording forbids.
  FR-029a's adjacent stability record carries the compliance argument. Owner already chose this;
  it wants a second reader to say whether the argument holds or the constitution wording should
  be amended (PATCH) to say what it actually means.

- [ ] **R-04 · Constitution vs. flat-file corpus** — *Architecture and Cost Constraints*
  The constitution mandates "Postgres with pgvector holds the claim graph, run schemas as jsonb,
  traces, snapshots, and embeddings" and forbids a separate store. Feature 005 built a flat-file
  git corpus (`corpus/claims/*/`) with no database at all. That is a good Phase-1 decision and it
  is also non-compliant as written. Decide: amend the constraint (MINOR — "single store" becomes
  "single store; a git-tracked flat file corpus is that store until the graph needs a database"),
  or record the corpus as a deliberate interim with a trigger for migrating. Either way, write it
  down; today the two documents contradict each other.

- [ ] **R-05 · Lenient placeholders in `assembleLedger`** — *Principle I, II*
  `src-pipeline/assemble-ledger.ts` writes fixed values for fields no step populates:
  `screens.falsifiability: 'pass'`, `silenceFinding: 'none'`, `channelKeys` all `null`, every
  rival `rebutted: false`. The first two are in the **lenient** direction — a strong-silence
  finding would cap a band, and an unfalsifiable claim should never reach Tree 1. The harm gate
  does reject non-falsifiable-shaped claims, so `'pass'` is defensible, but `silenceFinding` is
  not a finding, it is an assumption. Decide whether the engine should treat an absent silence
  finding as `'none'` (current) or refuse/cap until F-11 lands. Relates to the causal-skip
  precedent: unrun steps should be visible in the trace, not defaulted.

- [ ] **R-06 · Remediation attempt limit** — *Development Workflow*
  `MAX_REMEDIATION_ATTEMPTS = 2` in `src-pipeline/remediate.ts`. The constitution says the limit
  "MUST be set from observed failure modes, not guessed." Nobody has observed anything yet (no
  billed runs). Decision: leave at 2 and record it as provisional in the code comment, or make it
  a run option so measurement (F-14) can vary it. Do not silently keep a guessed constant.

- [ ] **R-07 · Status of manual-run records in the corpus** — *Principle II*
  Both committed claims were produced through `tools/manual-run/` and carry a `blindnessCaveat`.
  They are worked examples, not protocol-clean runs, and the report says so. Decide whether the
  public corpus should hold them as claim records at all, or whether they belong under
  `tests/fixtures/` until a real run replaces them. Affects F-06 (site index) — an index whose
  only two entries are caveated is a credibility question.

---

## F — Features (go through spec-kit; next feature number is 006)

Priority order. Depends-on lines are hard blockers; everything else can be reordered.

- [ ] **F-01 · Real Tree 2/3/4 judgment depth** — *Methodology · Schema · Principle I*
  The highest-value unbuilt feature. Today `evaluateTree2/3/4` receive only their
  `treeExtension`, `buildTreeExtension()` supplies a constant per claim type, and
  `run-pipeline.ts` short-circuits non-simple-factual claims past every evidence step. The band
  for a causal claim is a constant. Scope, in the order the trees demand it:
  - **Tree 2 (causal).** `underlyingFactualBand` needs a decomposed factual sub-claim evaluated
    on Tree 1 first — this is the first real use of the graph (`parentClaim` / `load_bearing`)
    and of bounded recursion (depth 2–3). Then a temporality step (does the cause precede the
    effect in the evidence?), the discriminating-criterion step, and the supportive-criteria
    count. Tree 2's "full Established condition set" is unspecified beyond FR-025–027; specifying
    it is methodology work that must happen in the spec, not in code.
  - **Tree 3 (predictive).** A step that tests Established-shaped conditions against evidence;
    the Probable cap stays.
  - **Tree 4 (complex-system).** A decomposition step producing `subClaimIds` as real corpus
    sibling claims, then `aggregate()` over their bands.
  - Remove the `skip-evidence-steps` branch and the probe `causal-band-is-constant.mts` (which
    should start failing — that is the acceptance test).
  Depends on: R-01 (baseline), F-13 (parent recompute) or build it inside. Consider splitting
  into 006 (Tree 2 + decomposition) and 007 (Trees 3, 4).

- [ ] **F-02 · Aggregator trace-through** — *Principle I, V*
  The warrant rubric says trace a derivative source to what it rests on. The gate can only
  refuse, and in the Great Wall re-run that cost a real line of evidence. Build: when
  `partitionCandidates` excludes an aggregator, fetch it anyway into the snapshot store (never
  into the ledger), extract outbound citations from the archived content deterministically
  (reference-list links, `<cite>`, DOI patterns), screen and enqueue those as candidates, and
  record the substitution on the trace (`aggregator → original` with both URLs). The aggregator
  itself still never becomes an origin. Acceptance: the Great Wall re-run recovers the astronaut
  statements without a human adding the URL.

- [ ] **F-03 · `protocol_version` and `registry_version` on every run** — *Schema · Principle III*
  Two of the six required stamps are missing from every stored run. Add `PROTOCOL_VERSION` (from
  AGENT-PROTOCOL-v3.md — decide who bumps it and when) and `REGISTRY_VERSION` (bumped on every
  `SEED_REGISTRY` change, enforced by a test that hashes the registry and compares to a committed
  value). Bump `SCHEMA_VERSION`, write the migration for the two committed runs, update
  `render-claim.ts` to stop naming the absence. Small, unblocked, and every later run without it
  is another record to migrate — do this early.

- [ ] **F-04 · Deterministic checks pass, run on every run** — *Principle III, V; Dev Workflow*
  The constitution lists nine checks that "run on every run". Some hold structurally inside the
  engine (zero-weight assertions, non-diagnostic exclusion, Tree 3 cap) but none are reported,
  and several are unimplemented: every origin has URL + fetch timestamp + content hash; cluster
  count equals partitions; every fired trigger has a named mechanism; band matches engine
  recompute; Tree 2 has a temporality finding. Build `src-pipeline/checks.ts` as pure functions
  over `(ledger, trace, fetchRecords)` returning named findings; run after `assembleLedger`;
  stamp results on the trace; render on the report. Add a CLI mode that re-checks every corpus
  record offline (this is the "revalidate from snapshots" requirement). Depends on: F-05 for the
  hash check.

- [ ] **F-05 · Snapshots and content hashes into the record** — *Schema · Principle V*
  `runs/` is gitignored, so the fetch archive (hash, status, final URL, timestamp) never reaches
  the repo. A cloner cannot offline-revalidate any committed record, and `evidenceFingerprint()`
  in `src-corpus/run-records.ts` cannot see a source that changed content at the same URL. Carry
  `contentHash`, `fetchedAt`, `httpStatus`, `finalUrl` into the run record's origin entries, and
  decide where archived text lives (`corpus/claims/<id>/snapshots/<hash>.txt` is the obvious
  answer; size and licensing of archived pages need a paragraph in the spec). Schema bump +
  migration.

- [ ] **F-06 · Site-wide index across claims** — *Principle III*
  Explicitly out of scope in 005. A landing page listing every claim with its band (with
  definition inline, never a number), claim type, run date, caveats (manual-run, superseded,
  missing stamps), and parent/child links. Same renderer discipline as 005: escape at the
  boundary in `html.ts`, allowlisted tags only. Blocked by R-07 for what it should show.

- [ ] **F-07 · Challenge mechanism** — *Principle III, VI*
  Contest a specific schema node. 005 made every protocol term citable (the precondition).
  Design as an authored file per challenge (`corpus/claims/<id>/challenges/<n>.md` with
  frontmatter naming the node path, e.g. `warrants[nasa-page].startingGrade`), a resolution
  section, and a rendered permanent attachment on the report — rejected challenges stay visible
  with their reason. Adjudication is human for now; the feature is the record and the rendering.
  This also unblocks the constitution's requirement that Poor/Fabricator reliability grades be
  claim nodes contestable the same way (Phase 3 in the brief).

- [ ] **F-08 · Harm-gate review-queue workflow** — *Principle VI*
  `runs/review-queue.jsonl` accumulates `needs_review` outcomes with nowhere to go. Build the
  minimal loop: list the queue, a human records accept/reject with the rule that fired, and the
  resolution feeds a re-run that skips the gate for that exact canonical restatement (byte-
  identical, per Principle IV). Track how long unresolved items sit.

- [ ] **F-09 · Adversarial-testing feedback into the warrant** — *Principle II*
  `revisionOccurred: true` is recorded but nothing re-grades. Re-run `gradeOrigin` for the lead
  origin with the surfaced weakness appended as untrusted data (it must not carry claim
  direction — check this against the blindness contract before designing). Both grades stay on
  the trace. Decide in the spec whether the re-grade can only lower.

- [ ] **F-10 · Interactive resume for `needs_clarification`** — *Principle IV*
  Needs persisted in-progress run state and an extension to `remediate()` to accept
  human-supplied context. Deferred by 004. Do after F-08, which builds the first persisted
  human-in-the-loop record and should share its shape.

- [ ] **F-11 · The judgment steps that are never run** — *Methodology-adjacent · Principle I, II*
  Each of these is a field the engine consumes and the pipeline hard-codes (see R-05). Each is a
  separate blind skill and can ship independently; grouped here so they are not forgotten:
  - **a. Contamination-channel calls** (`channelKeys.data/method/institution/motive`). The
    constitution assigns these to the judgment layer explicitly. Without them the
    interested-party table cannot fire correctly.
  - **b. Expected-silence finding** (`silenceFinding`). Would this claim, if true, have left
    evidence that is absent? Must not see the ledger; sees the claim and the origin set.
  - **c. Rival rebuttal** (`rivals[].rebutted`). Currently every rival survives forever.
  - **d. Extraordinary-cluster adversarial survival.** Extraordinary claims are always capped
    because `extraordinaryClusterSurvivedAdversarialTesting` is hard-coded `false`. Wire the
    adversarial step's result through when `isExtraordinary`.
  - **e. `correctedFormOfId`** — corrections detected by `detectRetractionOrCorrection` never
    link to the corrected origin.
  Until each lands, stamp `skip-step:<name>` on the trace the way the causal skip does, so the
  omission is visible (that stamping is a small change and could be an RF).

- [ ] **F-12 · Provider abstraction and step-level model tiering** — *Architecture (token cost)*
  `llm-client.ts` is Gemini-only, and Gemini's free tier no longer covers grounding. The
  constitution requires model tiering by step and prompt caching, decided by measurement. Split
  `LlmClient` into a provider-neutral interface with `generateJson` / `generateWithSearch`, add
  a second provider (Anthropic Claude with web search is the natural candidate — load the
  `claude-api` skill before choosing model IDs), and make the model per step a `RunOptions`
  field so F-14 can measure. The manual-run harness already proves the seam exists.

- [ ] **F-13 · Parent band recomputation from sub-claim bands** — *Architecture (staleness)*
  `aggregate()` exists in the engine; nothing in the corpus calls it. When a child's band
  changes, the parent recomputes at zero API cost. Needs DAG cycle detection at the point a
  `parentClaim` edge is read (`src-corpus/graph.ts`), and the `previous`-argument recompute
  convention from 001's contract. Prerequisite for F-01's Tree 4 path; can ship first.

- [ ] **F-14 · Measure real cost per claim** — *Architecture (token cost)*
  Blocked on billing (H-02). Once one paid run is possible: token counts per step on the trace,
  a `tools/cost-report.mts` over stored traces, and a written tiering decision. R-06's limit
  gets set here too.

- [ ] **F-16 · Engine 0.3.0: Tree 1 refutation per protocol, Doubtful reachable, symmetric
  steelman** — *Methodology · Schema · Principle I, II* — **NEXT UP; supersedes the 0.2.0
  counter-evidence path.** Outcome of R-01. Three parts, in this order because each is a
  precondition for the next:
  1. **Protocol amendment** to AGENT-PROTOCOL-v3.md: add a symmetric steelman step ("strongest
     case FOR the claim against the contrary evidence") with output Survived / Failed / Untested,
     and note that Refuted-from-evidence requires it Survived. Nothing else in the protocol text
     changes — (a) and (b) are the engine catching up to what it already says.
  2. **Schema** (`src/schema/ledger.ts`): add `counterAdversarialStatus: 'survived' | 'failed' |
     'untested'`; bump `SCHEMA_VERSION`; migrate the two corpus runs and the two manual-run
     transcripts with `'untested'`.
  3. **Engine** (`src/trees/tree1-simple-factual.ts`, `ENGINE_VERSION` → 0.3.0):
     - Refuted-from-evidence = one opposing cluster at `physical_documentary` AND
       `counterAdversarialStatus === 'survived'`. Drop the 2-cluster mirror.
     - Opposition outweighs support on grade or count → **Doubtful** (currently
       Contested-insufficient). Opposition clears the physical bar but is untested → Doubtful with
       a capping condition naming the missing steelman.
     - Fixtures: rework `tree1-refuted-by-counter-evidence` (now needs physical + survived),
       `tree1-unsupported-counter-below-bar`, add `tree1-doubtful-counter-outweighs`,
       `tree1-doubtful-physical-counter-untested`. `tree1-contested-conflicting-evidence` and
       `tree1-counter-evidence-blocks-established` should pass unchanged — if they don't, stop and
       ask.
     - Expected corpus drift: Great Wall `refuted → doubtful`, shown as superseded on its report.
  4. **Pipeline**: a `counter-steelman` step in `src-pipeline/` that receives the opposing
     origins only (blind to the ledger, same discipline as `gradeOrigin`), populates the field;
     stamp `skip-step:counter-steelman` until it exists.
  Go through spec-kit as feature 006. The spec must quote the protocol clauses it implements so a
  reviewer can diff engine against spec line by line.

- [ ] **F-15 · Amend 003's research.md** — small
  §1's premise that a Flash-tier model stays inside the free tier no longer holds. Amend when
  F-12 touches the client; note it here so it is not forgotten.

---

## RF — Refactors (no behaviour change; 338 tests stay green, fixtures untouched)

- [ ] **RF-01 · Remove the unreachable aggregator NOTE in `grade.ts`**
  `src-pipeline/grade.ts:187-191` still builds a prompt note for `registryClass === 'aggregator'`.
  Since `source-policy.ts` gates aggregators before retrieval and `assembleLedger` asserts, that
  branch cannot execute. Replace with an assertion (`throw` if an aggregator reaches grading) so
  a future bypass fails loudly, matching the gate's own philosophy. Keep the non-aggregator
  registry note — `preprint`/`press_release` are real grading context.

- [ ] **RF-02 · Extract trace assembly in `run-pipeline.ts`**
  The `RunTrace` literal is built twice (skip branch and full path) with identical fields.
  Extract `finishTrace()` so the next stamp (F-03 adds two, F-04 adds check results) is added
  once. Do this before F-03.

- [ ] **RF-03 · Make unrun steps visible in the trace** (companion to F-11, R-05)
  Add a `skippedSteps` list (or reuse the `skip-…` stamp convention) covering every hard-coded
  ledger field in `assembleLedger`. Render on the report under the process view. No band changes.

- [ ] **RF-04 · Split `src-corpus/render-claim.ts`** (675 lines)
  One module per report section (`sections/verdict.ts`, `provenance.ts`, `evidence.ts`,
  `process.ts`, `stability.ts`), each a pure function returning the same allowlisted node
  structure `html.ts` accepts. Precondition for F-06 and F-07, which each add sections. Keep the
  escape-at-the-boundary rule: no section module may emit a raw string.

- [ ] **RF-05 · Lint the whole repo**
  `eslint.config.js` only covers `src/**`; `package.json`'s `lint` is `eslint src`. Extend to
  `src-pipeline`, `src-corpus`, `dashboard`, `ui`, `tools` with the standard TS rules, keeping the
  determinism rules (`Date.now`, `new Date()`, `Math.random`) scoped to `src/**` where they
  belong. Fix what it finds in the same PR.

- [ ] **RF-06 · Single `RegistryClass` block list source**
  `RunTrace.excludedSources[].registryClass` is typed `string | null` while `SourceScreening`
  uses `RegistryClass | null`. Align the types so a renamed class fails compilation at the trace.

- [ ] **RF-07 · Manual-run harness test**
  `tools/manual-run/` has no test. Add one that replays `transcripts/great-wall` through
  `runOrchestration` with the manual client and asserts the band the corpus record carries.
  This turns the two committed records into regression fixtures for the whole orchestration —
  cheap insurance for F-01's removal of the skip branch.

- [ ] **RF-08 · `package.json` identity**
  Still `@groundtruth/rule-engine` at `0.1.0`, described as the engine only, with `main` pointing
  at `dist/index.js`. The repo is now five packages in one. Either rename to the platform and
  drop `main`/`types`, or leave and add a `README.md` line explaining the name is historical.
  Not urgent; confusing for a newcomer.

---

## H — Housekeeping

- [ ] **H-01 · Rotate the Gemini key in `.env`.** It was pasted into a prior chat. Rotate at
  aistudio.google.com, replace the value, confirm `.env` is still gitignored (it is:
  `.gitignore` line 5). Nothing else references the key by value.
- [ ] **H-02 · Decide on Gemini billing** (or not). Without it no live 003 run is possible; with
  it, 5,000 grounded searches/month are free. Gates F-14 and the first non-caveated corpus
  record. Alternative is F-12.
- [ ] **H-03 · Remove the SYNC IMPACT REPORT comment** from the top of
  `.specify/memory/constitution.md` — it says "remove before commit" and was committed.
- [ ] **H-04 · Move `.specify/feature.json`** to the next feature when one is specified; it still
  points at `specs/005-claim-corpus-report`.
- [ ] **H-05 · Brief checkboxes.** `GROUNDTRUTH-PLATFORM-BRIEF-v0.2.md` §18 still shows every
  Phase 0/1 item unticked though most are built. Tick what is done, so the brief and this file
  agree on state.

---

## Suggested sequence

1. ~~R-01~~ done → **F-16** (engine 0.3.0) is the next build. **R-02, R-04** alongside.
2. **H-01** (five minutes), **RF-02, RF-01, RF-05** — cheap, and they make the next changes smaller.
3. **F-03** — closes the provenance gap while there are only two records to migrate. Share
   F-16's schema bump and migration so the corpus runs are migrated once, not twice.
4. **RF-03 + R-05** — make every unrun step visible before adding real ones.
5. **F-05 → F-04** — snapshots into the record, then the checks pass that reads them.
6. **F-13 → F-01** — parent recompute, then real Tree 2/3/4 depth (the big one; split it).
7. **F-02** in parallel with 6 — it only touches discovery/retrieval.
8. **RF-04 → F-06, F-07** — split the renderer, then the index and the challenge record.
9. **F-08 → F-10, F-09, F-11, F-12/F-14** as capacity allows.

---

## Done

(Move completed items here with the commit hash.)

- [x] **R-01 · Engine 0.2.0 methodology review** — decided 2026-09-17 by the owner (uncommitted at
  time of writing). Rulings: (a) refutation bar follows the protocol text — one decisive opposing
  cluster at `physical_documentary`, the 2-cluster mirror is dropped; (b) Doubtful becomes
  reachable — opposition outweighing support on grade or count lands there, per the protocol;
  (c) Refuted-from-evidence additionally requires the counter-evidence to survive a symmetric
  steelman, which needs a protocol amendment, a schema field and a pipeline step — blocked until
  they ship, meanwhile counter-evidence caps at Doubtful; (d) non-diagnostic asymmetry accepted as
  the burden of proof working correctly. Full reasoning in PROJECT-TRACKER.md → Resolved. Build
  is F-16.
