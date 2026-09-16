/**
 * The page's entire stylesheet, inlined into every generated report.
 *
 * Inlined rather than linked because FR-027d requires a page that fetches
 * nothing: a stylesheet request would tell whoever serves it which claim is
 * being read, which is a privacy property as much as a technical one. Same
 * reason there is no web font — the system stack only.
 *
 * Colour never carries meaning alone. Every band is stated in words and defined
 * in full beside its own label, so the page reads identically to someone who
 * cannot distinguish the hues, and nothing here can be mistaken for a score
 * (FR-015).
 */
export const PAGE_STYLE = `
:root {
  --bg: #fbfaf8;
  --surface: #ffffff;
  --surface-sunken: #f4f2ee;
  --ink: #1a1a18;
  --ink-muted: #5c5a54;
  --ink-faint: #85827a;
  --rule: #e2ded6;
  --rule-strong: #c9c4b8;
  --accent: #2f5d50;
  --support: #2f6b4f;
  --oppose: #9a3412;
  --neither: #6b6864;
  --warn-bg: #fdf6e3;
  --warn-rule: #d9c48a;
  --warn-ink: #6b5310;
  --band-refuted: #9a3412;
  --band-established: #2f6b4f;
  --band-probable: #3f6b8a;
  --band-contested: #8a6a1f;
  --band-neutral: #5c5a54;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #16161a;
    --surface: #1d1d22;
    --surface-sunken: #232329;
    --ink: #eceaf0;
    --ink-muted: #a8a5b0;
    --ink-faint: #85828e;
    --rule: #33333c;
    --rule-strong: #4a4a56;
    --accent: #7fc7ae;
    --support: #6fbf94;
    --oppose: #f0906a;
    --neither: #9a97a2;
    --warn-bg: #2b2415;
    --warn-rule: #6b5a2a;
    --warn-ink: #e8d9a8;
    --band-refuted: #f0906a;
    --band-established: #6fbf94;
    --band-probable: #86b7d8;
    --band-contested: #d8b45e;
    --band-neutral: #a8a5b0;
  }
}

* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.62 ui-serif, Georgia, 'Times New Roman', serif;
  -webkit-text-size-adjust: 100%;
}
main { max-width: 52rem; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
@media (max-width: 30rem) { main { padding: 1.5rem 1rem 3rem; } }

h1, h2, h3, h4 { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif; line-height: 1.25; }
h1 { font-size: 1.75rem; margin: 0 0 .5rem; letter-spacing: -.01em; }
h2 {
  font-size: .82rem; text-transform: uppercase; letter-spacing: .09em;
  color: var(--ink-faint); margin: 3rem 0 .9rem;
  padding-bottom: .4rem; border-bottom: 1px solid var(--rule);
}
h3 { font-size: 1.02rem; margin: 1.6rem 0 .5rem; }
h4 { font-size: .92rem; margin: 1.2rem 0 .4rem; }
p { margin: 0 0 .9rem; }
a { color: var(--accent); text-decoration-thickness: 1px; text-underline-offset: 2px; }
code, pre, .mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }
code { font-size: .86em; background: var(--surface-sunken); padding: .1em .32em; border-radius: 3px; }
pre { background: var(--surface-sunken); padding: .9rem; border-radius: 6px; overflow-x: auto; }
pre code { background: none; padding: 0; }
blockquote { margin: 0 0 .9rem; padding-left: 1rem; border-left: 3px solid var(--rule-strong); color: var(--ink-muted); }
small { font-size: .82rem; }

.eyebrow { font-family: ui-sans-serif, system-ui, sans-serif; font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 .75rem; }
.claim-text { font-size: 1.32rem; line-height: 1.45; margin: 0 0 1rem; }
@media (max-width: 30rem) { .claim-text { font-size: 1.12rem; } }
.claim-id { font-size: .76rem; color: var(--ink-faint); word-break: break-all; }

/* The verdict block. The band is a word with its meaning attached, never a
   score, and never a bare label a reader has to look up. */
.verdict {
  background: var(--surface); border: 1px solid var(--rule);
  border-left: 5px solid var(--band, var(--band-neutral));
  border-radius: 8px; padding: 1.25rem 1.35rem; margin: 1.5rem 0;
}
.verdict-band {
  font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 650;
  font-size: 1.5rem; color: var(--band, var(--band-neutral));
  margin: 0 0 .1rem; letter-spacing: -.01em;
}
.verdict-qualifier { font-family: ui-sans-serif, system-ui, sans-serif; font-size: .88rem; color: var(--ink-muted); margin: 0 0 .7rem; }
.verdict-definition { margin: 0; color: var(--ink-muted); font-size: .96rem; }
.band-established { --band: var(--band-established); }
.band-probable { --band: var(--band-probable); }
.band-contested, .band-doubtful { --band: var(--band-contested); }
.band-refuted { --band: var(--band-refuted); }
.band-unsupported, .band-unresolvable, .band-unfalsifiable { --band: var(--band-neutral); }

.notice {
  background: var(--warn-bg); border: 1px solid var(--warn-rule); color: var(--warn-ink);
  border-radius: 6px; padding: .85rem 1rem; margin: 1rem 0; font-size: .92rem;
}
.notice strong { display: block; font-family: ui-sans-serif, system-ui, sans-serif; margin-bottom: .2rem; }
.notice p:last-child { margin-bottom: 0; }

table { width: 100%; border-collapse: collapse; font-size: .9rem; margin: .5rem 0 1rem; }
th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid var(--rule); vertical-align: top; }
th { font-family: ui-sans-serif, system-ui, sans-serif; font-size: .74rem; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-faint); font-weight: 600; }
.scroll-x { overflow-x: auto; }

.origin { border: 1px solid var(--rule); border-radius: 6px; padding: .9rem 1rem; margin: 0 0 .75rem; background: var(--surface); }
.origin-url { font-size: .82rem; word-break: break-all; margin: 0 0 .5rem; }
.origin.supports { border-left: 4px solid var(--support); }
.origin.opposes { border-left: 4px solid var(--oppose); }
.origin.neither { border-left: 4px solid var(--neither); }
.group-label { font-family: ui-sans-serif, system-ui, sans-serif; font-size: .82rem; font-weight: 600; margin: 1.4rem 0 .2rem; }
.group-note { font-size: .84rem; color: var(--ink-muted); margin: 0 0 .7rem; }

.facts { display: flex; flex-wrap: wrap; gap: .4rem .5rem; margin: .5rem 0 0; padding: 0; list-style: none; }
.fact {
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: .78rem;
  background: var(--surface-sunken); border: 1px solid var(--rule);
  border-radius: 999px; padding: .18rem .6rem; color: var(--ink-muted);
}
.fact .term { color: var(--ink-faint); }

.term-pair { font-family: ui-sans-serif, system-ui, sans-serif; }
.term-code { color: var(--ink-faint); font-size: .84em; }

dl.meta { margin: 0; display: grid; grid-template-columns: minmax(8rem, max-content) 1fr; gap: .35rem .9rem; font-size: .88rem; }
@media (max-width: 30rem) { dl.meta { grid-template-columns: 1fr; gap: .1rem; } dl.meta dd { margin-bottom: .5rem; } }
dl.meta dt { font-family: ui-sans-serif, system-ui, sans-serif; color: var(--ink-faint); font-size: .8rem; }
dl.meta dd { margin: 0; word-break: break-word; }

ol.trace { margin: 0; padding-left: 1.2rem; font-size: .9rem; }
ol.trace li { margin-bottom: .3rem; }
.attempt-failed { color: var(--oppose); }
.attempt-ok { color: var(--support); }

.authored {
  background: var(--surface-sunken); border: 1px dashed var(--rule-strong);
  border-radius: 8px; padding: 1rem 1.2rem; margin: .75rem 0;
}
.authored-heading { margin-top: 1rem; }
.authored .provenance-label {
  font-family: ui-sans-serif, system-ui, sans-serif; font-size: .72rem;
  letter-spacing: .1em; text-transform: uppercase; color: var(--ink-faint); margin: 0 0 .6rem;
}
.inert-link { color: var(--ink-faint); text-decoration: line-through; }

.glossary dt { font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 600; font-size: .9rem; margin-top: .7rem; }
.glossary dd { margin: .1rem 0 0; font-size: .9rem; color: var(--ink-muted); }

footer { margin-top: 3.5rem; padding-top: 1rem; border-top: 1px solid var(--rule); font-size: .8rem; color: var(--ink-faint); }
`;
