# Research: Claim Corpus Structure and Visual Claim Report

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Phase 0. Every decision below was either forced by the spec's clarifications or is a genuine choice
with alternatives, recorded so a reviewer can disagree with the reasoning rather than just the
result.

## 1. Zero new runtime dependencies

**Decision**: Add no runtime dependency. Build the frontmatter parser, the Markdown subset renderer
and the HTML escaping primitives in-repo, and validate with `zod`, which `001` already depends on.

**Rationale**: The repository has exactly two runtime dependencies (`zod`, `@google/genai`) after
four features, which is a deliberate posture rather than an accident. This feature's entire output
is static text assembled from local files, and each candidate dependency solves a problem that the
security requirements (FR-027a–d) reshape into something smaller than the library. A Markdown
library is sized for the whole CommonMark surface; we need six constructs and explicitly must not
support raw HTML. A sanitiser is sized for cleaning arbitrary untrusted HTML; we never produce
arbitrary HTML in the first place. A YAML parser is sized for a type system we do not want.

**Alternatives considered**: `marked` or `markdown-it` plus `sanitize-html` or `DOMPurify`. This is
the conventional stack and it works, but it inverts the security posture — see §2. `gray-matter`
for frontmatter, which is small and well-used, but it delegates to full YAML, which §3 rejects on
grounds other than size.

## 2. Escape at the boundary, construct only known tags

**Decision**: Never produce HTML by sanitising HTML. Every string that reaches the page is escaped
as it crosses the boundary, and every tag on the page is emitted by a function in `html.ts` that
constructs it from an allowlisted tag name and pre-escaped children. The Markdown renderer is built
on those primitives, so it can only ever produce tags that `html.ts` knows how to construct.

**Rationale**: Parse-then-sanitise is a blocklist: the parser produces arbitrary HTML and the
sanitiser removes the parts currently known to be dangerous. Its failure mode is silent and
open-ended — a construct the sanitiser does not recognise passes through. Construct-only is an
allowlist with a much smaller trusted surface: to emit a `<script>` the code would have to contain a
line emitting a `<script>`, and there is no such line. This also collapses FR-027a (strip raw HTML),
FR-027b (escape run-record strings) and FR-027d (no executable content) into one mechanism instead
of three overlapping ones, which matters because three overlapping mechanisms is how a gap appears
between them.

The subset is fixed at: ATX headings (levels 2–4), paragraphs, emphasis and strong emphasis, ordered
and unordered lists, inline code and fenced code blocks, block quotes, and inline links. Anything
else — tables, images, footnotes, raw HTML, reference links, autolinks — renders as literal text
rather than being silently dropped, so a contributor sees immediately that it did not work.

**Alternatives considered**: Rendering Markdown with a library configured to disable raw HTML (for
example `marked` with `sanitize` semantics). The disabling flags on these libraries have historically
been deprecated, removed or incomplete, and the resulting posture still depends on the library's own
notion of what is dangerous. Escaping everything and rendering nothing, which is safest of all but
makes longer authored analyses unreadable and was rejected in the spec's fourth clarification.

## 3. Restricted frontmatter, not YAML

**Decision**: Parse frontmatter as a deliberately restricted subset: `key: value` scalar lines, a
block-scalar form for multi-line strings, and simple `- item` lists. Anything outside the subset is
an error naming the file and line. The parsed object is then validated by a `zod` schema that
rejects unknown keys.

**Rationale**: FR-012 requires *rejecting* an engine-computed field in authored metadata rather than
ignoring it, which means the parser must be able to say "this key is not allowed here" — so a strict
schema is required regardless of parser choice. Given that, full YAML adds only risk: implicit
typing means `edgeType: no` becomes a boolean, a restatement beginning with a digit and a colon can
become a sexagesimal number, and `parentClaim: 1.20` loses a digit. These are exactly the kinds of
silent mutations that corrupt claim identity, which FR-007's whole design is built to prevent.

**Alternatives considered**: Full YAML via a dependency, with a schema layered on top to catch the
coercions — workable, but it means the parse step can still change a value before validation sees
it, and validation cannot recover the original text. JSON frontmatter, which has no implicit typing
and needs no new parser, but is unpleasant to hand-author for multi-line prose and unfamiliar to
contributors who expect Markdown frontmatter to look like YAML.

## 4. Displayed band, drift check, and the two engines

**Decision**: The page displays the band the run record stores, labelled with the engine version that
produced it. At generation time the ledger is re-evaluated with the current engine; if the result
differs, the page shows both, marks the record superseded, and names both engine versions. If the
record's schema version is one the current engine will not accept, the page shows the recorded band
and states that the drift check could not run.

**Rationale**: This is the spec's first clarification, and it resolves a real conflict rather than a
hypothetical one. Principle I says code computes the band; Principle III's versioning policy says
runs are stamped "so old verdicts stay reproducible against the rules that produced them." Both
hold if the stored band is treated as *that run's* finding under *that engine*, and the current
engine's disagreement is treated as new information about methodology rather than as a correction to
history. The failure this avoids is concrete: bumping the engine to 0.2.0 on 2026-09-15 moved a
stored record from Contested to Refuted off an unchanged ledger, so a renderer that silently
recomputed would have shown a band that no stored record anywhere contains.

**Alternatives considered**: Always recompute, which makes the page contradict the record it cites
and destroys reproducibility. Never recompute, which lets a page display a verdict the current
methodology would reject, indefinitely and invisibly. Refusing stale records, which makes one engine
bump blank the entire site.

## 5. Identity, directory naming, and immutability

**Decision**: A claim's directory name is derived from its canonical restatement by a deterministic
transform (lowercase, non-alphanumerics collapsed to hyphens, trimmed, truncated to a fixed length)
with a short content hash of the full restatement appended. Collisions are therefore impossible for
distinct restatements, and identical restatements produce identical directory names, which is what
makes FR-007's byte-identical auto-linking fall out of the naming scheme rather than needing a
separate index.

The canonical restatement lives in the claim record's frontmatter and is frozen once the claim holds
a run (FR-007a). The directory name is derived from it, so freezing the restatement freezes the
directory name too. A read verifies that the directory name still matches its restatement and that
every run record's stored claim text matches as well; either mismatch fails the read.

**Rationale**: Slug-plus-hash gets readable paths and guaranteed uniqueness at once, and it means
identity is verifiable from the filesystem alone with no lookup table to fall out of sync. Long,
non-Latin or filesystem-hostile restatements degrade gracefully: the readable prefix may shrink to
nothing, but the hash still identifies the claim exactly.

**Alternatives considered**: A pure opaque id (a UUID), which is collision-free and immune to
restatement changes but makes every path unreadable and every diff meaningless in review — a serious
cost for a corpus whose review happens in pull requests. A pure slug with a numeric disambiguation
suffix, which produces order-dependent names: the same two claims added in the other order get
different directories, breaking determinism and any link already made.

## 6. Rejected claims must not be republished

**Decision**: A claim rejected by the harm gate is stored under an opaque identifier with **no**
canonical restatement written to the corpus at all. Its page publishes the rule that fired, the run
identifier and the date. It does not publish the claim text, and its directory name does not encode
the claim text.

**Rationale**: This resolves a genuine conflict inside Principle VI, which both requires that
"rejections MUST state the rule that fired, so the boundary is inspectable rather than a silent
filter" and exists to stop the system producing "a confident-sounding automated verdict about a
named person." A claim rejected for naming a private individual, republished verbatim on a public
page so the rejection is inspectable, would be the platform performing exactly the harm its intake
gate refused — and at higher reach, since the rejection page is public and permanent.

Publishing the rule without the allegation satisfies the inspectability requirement as written: what
needs to be auditable is the *boundary* — which rule fired, how often, and whether the gate is being
applied consistently — not the content of what was turned away. Note the second-order consequence:
because §5 derives directory names from restatements, a rejected claim cannot use the normal naming
scheme at all; the slug itself would republish the claim. Rejected claims therefore take a hash-only
identifier.

**Alternatives considered**: Publishing rejected claims verbatim, which is inspectable and
straightforwardly wrong. Not publishing rejections at all, which the spec's second clarification
rejected because it makes the gate the silent filter the constitution forbids. Publishing a
model-written paraphrase of the rejected claim, which sounds like a compromise but is worse than
either: it still conveys the allegation, and it does so in wording nobody is accountable for.

## 7. What the process view has to carry, and what is missing

**Decision**: Render the full step sequence, every source pulled with its retrieval outcome, and
every remediation attempt including failures with the violation each reported. Render the stamps the
records actually carry — run id, requester, model ids, engine version, schema version, timestamps.
State explicitly on the page that `protocol_version` and `registry_version` are not recorded.

**Rationale**: Principle III lists six stamps as mandatory on every run, and `003`'s record schema
carries four of them. This feature cannot add stamps to records written before it existed, and
inventing plausible values would be worse than the gap. Naming the absence keeps the page honest and
turns a silent schema shortfall into something a reader can see and a maintainer is prompted to fix.
The alternative — printing four stamps under a heading implying completeness — is the kind of
quiet partial-truth the whole project exists to avoid.

**Alternatives considered**: Blocking the feature until `003`'s schema is amended and stored runs
migrated. That is the correct eventual fix, but it is a schema change with a migration under
Principle IV, it belongs to `003` rather than here, and holding the entire public-facing surface
hostage to it would leave the corpus unreadable for no safety gain.

## 8. Determinism

**Decision**: Sort every collection by an explicit key before rendering; never iterate object keys
for output order without sorting; format all dates as fixed-format UTC; emit exactly one
generation timestamp, in one place, marked as such. A golden-file test renders a fixture corpus
twice and asserts the outputs are identical except for that line.

**Rationale**: SC-010 requires it, but the real reason is review: if generation is not
deterministic, the diff of a regenerated site is noise, and nobody reviews noise. Filesystem read
order is not guaranteed across platforms, and this repository is being developed on Windows while
its contributors will not be.

**Alternatives considered**: Stamping no timestamp at all, which would make output perfectly
reproducible but loses the "generated at" provenance the page should carry. Stamping the source
record's own timestamp instead, which conflates when the run happened with when the page was built.
