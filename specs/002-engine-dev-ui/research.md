# Phase 0 Research: Rule Engine Dev UI

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1. No UI framework

**Decision**: Vanilla TypeScript + DOM APIs, built and served by Vite. No React/Vue/Svelte/etc.

**Rationale**: The entire surface is five things — a text area, a run button, a mode toggle, a
fixture list, and a results panel. A framework's component model, build config, and dependency
weight exist to manage complexity that this tool doesn't have. The engine itself is
dependency-free by design (Constitution Principle I's minimalism, extended here); a heavyweight
frontend stack for a five-widget internal tool would be the one part of this codebase that didn't
match that ethos.

**Alternatives considered**: *React* — the project's own `frontend-design` conventions assume it
for polished product UI, but this is explicitly an internal dev tool (spec Assumptions), not a
product surface; React's value (component reuse across a growing app, complex state) doesn't
apply to five widgets that don't change shape. *A framework-free but bundler-free approach (raw
`<script type="module">` in the HTML)* — avoids Vite entirely, but loses `import.meta.glob`
(needed for fixture discovery, see §2) and TypeScript compilation, both of which Vite gives for
free with almost no config.

## 2. Fixture discovery: `import.meta.glob`, not a generated manifest

**Decision**: `ui/fixture-library.ts` uses Vite's `import.meta.glob('/tests/fixtures/cases/*.ts',
{ eager: true })` to discover and import every fixture case at build time.

**Rationale**: The engine's own fixture-suite runner (`tests/suite/run-fixtures.test.ts`)
discovers fixtures with Node's `readdirSync`, which doesn't exist in a browser bundle.
`import.meta.glob` is Vite's browser-safe equivalent — it resolves the file list at build time and
inlines the imports, so the UI's fixture list is always exactly the same set of files the fixture
suite runs, with no separate manifest to keep in sync and no risk of the two drifting apart.

**Alternatives considered**: *A generated JSON manifest listing fixture ids* — would need a build
step to stay current and is exactly the kind of second source of truth FR-008/FR-009 are trying to
avoid (the fixture library must reflect the real fixture files, not a snapshot of them).
*Fetching fixture files at runtime over HTTP* — would introduce a network request, directly
violating FR-012/SC-005's zero-network-to-produce-a-verdict requirement, even though listing
fixtures isn't itself "producing a verdict" — simplest to keep the whole tool network-free rather
than draw that line finely.

## 3. Testing: Vitest + jsdom, scoped per file

**Decision**: Reuse the existing Vitest setup, adding `jsdom` as a devDependency. UI tests that
touch the DOM declare `// @vitest-environment jsdom` at the top of the file; the engine's own
tests (still `node` environment) are untouched.

**Rationale**: Introducing a second test *runner* (e.g., Playwright) for a five-widget tool is
disproportionate, and Vitest already supports per-file environment overrides natively — no new
config file, no context-switching between two test tools in one small repository. `jsdom` itself
is an unavoidable one-line dependency addition: Vitest's environment switching needs an actual DOM
implementation to switch to, it doesn't ship one.

**Alternatives considered**: *Playwright/real-browser e2e tests* — genuinely more realistic, but
a heavier setup (browser binaries, a running dev server) than this feature's size warrants; worth
reconsidering only if the UI grows real interaction complexity beyond paste/run/display.
*No DOM tests at all, manual verification only* — the fixture-suite integrity guarantee (SC-002:
100% of fixtures reproduce their expected verdict through the UI) is exactly the kind of thing
that regresses silently without an automated check, so some DOM-level test coverage is worth the
small setup cost.

## 4. Three distinct result states, one rendering path

**Decision**: `engine-bridge.ts` returns a tagged result: `{ kind: 'parse-error'; message: string
} | { kind: 'refusal'; reason: string } | { kind: 'verdict'; verdict: Verdict }`.
`verdict-display.ts` renders each kind with a visually distinct treatment — this is the concrete
mechanism behind FR-006's and FR-007's "visually distinguished" requirement.

**Rationale**: These three states have different causes and need different user reactions: a
parse error means the JSON itself is broken (fix a typo); a refusal means the JSON parsed but the
engine's own schema rejected it (fix a field per FR-003's schema, per the engine's own
`refusalReason` text); a verdict is a real, valid result. Collapsing these into one generic
"error vs. success" binary would hide which of the first two applies, undermining SC-004's
"specific, actionable message" requirement.

**Alternatives considered**: A single error string covering both parse and refusal cases — simpler
to build, but a developer can't tell from the message alone whether the problem is their JSON
syntax or their ledger's content, which is exactly the distinction FR-006/FR-007 exist to preserve.

## 5. Visual design: functional and legible, not a branded product surface

**Decision**: Plain CSS, a single typeface, a neutral palette, and layout driven entirely by the
tool's five widgets — no attempt at a distinctive visual identity.

**Rationale**: The `frontend-design` skill's guidance (distinctive palette, considered type,
intentional layout) is aimed at product and marketing surfaces where visual identity carries
meaning. This tool's entire audience is one developer/reviewer using it as an instrument, and its
job is to get out of the way of the data it's showing — legibility and information density matter
here far more than brand personality. This is a considered application of the skill's own
underlying principle (make deliberate choices for the actual brief) rather than a departure from
it: for *this* brief, restraint and neutrality are the deliberate choice, not the generic
default. The skill's warnings against templated AI-tells (cream/terracotta palettes, SaaS-card
kits, tracked-out eyebrow labels) are followed regardless, since those would look out of place in
a dev instrument even more than in a branded product.

**Alternatives considered**: A fuller design pass (distinctive palette/type per the skill's usual
process) — reasonable if this tool were ever repositioned as something other people outside the
project use unassisted, but disproportionate for its current, single-user, internal scope.
