import { el, escapeText, link, join, empty, document as htmlDocument, type Html } from './html.js';
import { renderMarkdown } from './markdown.js';
import { PAGE_STYLE } from './page-style.js';
import { lookup, has, isEngineConditionId, allTerms, type VocabularyTerm } from './vocabulary.js';
import { displayedVerdict, evidenceFingerprint, blockedOriginsIn, type StoredRun } from './run-records.js';
import type { Claim } from './corpus.js';

/**
 * Assembles one claim's page.
 *
 * Two structural rules come straight from the constitution and are not
 * negotiable at the layout level. The process view sits in the document above
 * the glossary and is never behind an interaction, because Principle III makes
 * it a launch requirement rather than an appendix. And nothing here decides a
 * band: the page prints what a run recorded and, separately, what today's
 * engine computes. There is no band logic in this file to get wrong.
 */

export interface RenderOptions {
  /** Claims that name this one as their parent, for the relationships section. */
  children?: { id: string; restatement: string; edgeType: string }[];
  /** The claim this one supersedes, and the one that supersedes it. */
  supersededBy?: { id: string; restatement: string };
  generatedAt?: string;
}

/** Plain language leads, the exact protocol term follows in brackets (FR-015a).
 * The term is never dropped — a challenge has to be able to cite the field. */
function term(value: string): Html {
  const v = lookup(value);
  return el(
    'span',
    { class: 'term-pair' },
    escapeText(v.plain),
    escapeText(' '),
    el('span', { class: 'term-code' }, escapeText(`(${v.term})`)),
  );
}

function fact(label: string, value: Html): Html {
  return el('li', { class: 'fact' }, el('span', { class: 'term' }, escapeText(`${label}: `)), value);
}

function metaRow(label: string, value: Html): Html {
  return join([el('dt', {}, escapeText(label)), el('dd', {}, value)]);
}

function notice(title: string, body: Html): Html {
  return el('div', { class: 'notice' }, el('strong', {}, escapeText(title)), body);
}

const UTC = (iso: string): string => {
  if (!iso) return 'not recorded';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function renderHeader(claim: Claim): Html {
  const restatement = claim.record.canonicalRestatement;
  const aliases =
    claim.record.aliases.length > 0
      ? el(
          'p',
          { class: 'claim-id' },
          escapeText(`Also recorded as: ${claim.record.aliases.join(' · ')}`),
        )
      : empty;
  return el(
    'header',
    {},
    el('p', { class: 'eyebrow' }, escapeText('GroundTruth claim record')),
    el(
      'h1',
      { class: 'claim-text' },
      escapeText(restatement ?? 'A claim rejected at intake'),
    ),
    el('p', { class: 'claim-id' }, escapeText(claim.id)),
    aliases,
  );
}

function renderVerdict(run: StoredRun): Html {
  const v = displayedVerdict(run);
  if (!v) return empty;
  const band = lookup(v.recordedBand);
  const qualifier = v.recordedQualifier && has(v.recordedQualifier) ? lookup(v.recordedQualifier) : null;

  const driftNotice =
    v.drift === 'superseded' && v.currentBand
      ? notice(
          'This verdict has been superseded by a change in methodology.',
          join([
            el(
              'p',
              {},
              escapeText(
                `The band above is what this run concluded under engine ${v.recordedEngineVersion}. The current engine ` +
                  `(${v.currentEngineVersion}) reaches a different conclusion from the same evidence: `,
              ),
              el('strong', {}, escapeText(lookup(v.currentBand).plain)),
              escapeText('.'),
            ),
            el(
              'p',
              {},
              escapeText(
                'Both are shown because each run is stamped with its engine version so that old verdicts stay ' +
                  'reproducible against the rules that produced them. Re-running the claim would record the newer finding.',
              ),
            ),
          ]),
        )
      : v.drift === 'uncheckable'
        ? notice(
            'The current engine could not re-check this verdict.',
            el('p', {}, escapeText(`${v.uncheckableReason ?? 'reason not recorded'}. The recorded band is shown unchanged.`)),
          )
        : empty;

  return join([
    el('h2', {}, escapeText('Verdict')),
    el(
      'div',
      { class: `verdict band-${v.recordedBand}` },
      el('p', { class: 'verdict-band' }, escapeText(band.plain)),
      qualifier ? el('p', { class: 'verdict-qualifier' }, escapeText(qualifier.plain)) : empty,
      el('p', { class: 'verdict-definition' }, escapeText(band.definition)),
    ),
    el(
      'p',
      { class: 'claim-id' },
      escapeText(`Computed by the rule engine, version ${v.recordedEngineVersion}, from the evidence below. `),
      escapeText('The engine assigns the band; no model chooses it, and it carries no score or percentage.'),
    ),
    driftNotice,
  ]);
}

function renderStability(claim: Claim, displayed: StoredRun): Html {
  const completed = claim.runs.filter((r) => r.kind === 'completed');
  if (completed.length <= 1) return empty;

  const displayedPrint = evidenceFingerprint(displayed);
  const rows = completed.map((run) => {
    const v = displayedVerdict(run);
    const same = evidenceFingerprint(run) === displayedPrint;
    return el(
      'tr',
      {},
      el('td', {}, escapeText(UTC(run.recordedAt))),
      el('td', {}, escapeText(v?.recordedEngineVersion ?? '—')),
      el('td', {}, v ? escapeText(lookup(v.recordedBand).plain) : escapeText('—')),
      el('td', {}, escapeText(same ? 'same evidence' : 'different evidence')),
    );
  });

  // FR-029a: disagreement between runs on one evidence base is surfaced HERE,
  // beside the band, not left to a reader comparing rows.
  const displayedBand = displayedVerdict(displayed)?.recordedBand;
  const disagreeing = completed.filter(
    (r) => evidenceFingerprint(r) === displayedPrint && displayedVerdict(r)?.recordedBand !== displayedBand,
  );

  return join([
    el('h2', {}, escapeText('Stability across runs')),
    disagreeing.length > 0
      ? notice(
          'Runs on the same evidence disagreed.',
          el(
            'p',
            {},
            escapeText(
              `${disagreeing.length} earlier run(s) reached a different band from the one displayed, using the same ` +
                'set of sources. Treat the displayed band as unstable rather than settled.',
            ),
          ),
        )
      : empty,
    el(
      'div',
      { class: 'scroll-x' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, el('th', {}, escapeText('Run')), el('th', {}, escapeText('Engine')), el('th', {}, escapeText('Band')), el('th', {}, escapeText('Evidence base')))),
        el('tbody', {}, join(rows)),
      ),
    ),
  ]);
}

function renderProvenance(run: StoredRun): Html {
  const trace = run.trace;
  const prov = (run.provenance ?? {}) as Record<string, unknown>;
  const caveat = typeof prov.blindnessCaveat === 'string' ? prov.blindnessCaveat : null;

  const rows: Html[] = [
    metaRow('Run id', el('span', { class: 'mono' }, escapeText(run.runId))),
    metaRow('Requester', escapeText(trace?.requester ?? 'not recorded')),
    metaRow('Models', escapeText(trace?.modelIds.join(', ') ?? 'not recorded')),
    metaRow('Started', escapeText(UTC(trace?.startedAt ?? ''))),
    metaRow('Completed', escapeText(UTC(trace?.completedAt ?? ''))),
  ];
  if (typeof prov.producedBy === 'string') rows.push(metaRow('Produced by', escapeText(prov.producedBy)));
  if (typeof prov.llm === 'string') rows.push(metaRow('Answered by', escapeText(prov.llm)));
  if (typeof prov.reason === 'string') rows.push(metaRow('Why', escapeText(prov.reason)));

  return join([
    el('h2', {}, escapeText('How this verdict was produced')),
    // FR-022 / SC-005: the caveat is placed BEFORE the metadata table and needs
    // no interaction to see. A reader must not be able to reach the evidence
    // believing a human-assisted record was an unattended protocol run.
    caveat
      ? notice('This is not a protocol-clean run.', el('p', {}, escapeText(caveat)))
      : empty,
    el('dl', { class: 'meta' }, join(rows)),
    // research.md §7: naming the absent stamps rather than presenting four of
    // six under a heading that implies completeness.
    notice(
      'Two required provenance stamps are missing from this record.',
      el(
        'p',
        {},
        escapeText(
          'The protocol requires every run to record a protocol version and a registry version alongside the ' +
            'engine and schema versions shown above. The pipeline that produced this record does not yet write ' +
            'either. They are named here rather than omitted, so the provenance is not mistaken for complete.',
        ),
      ),
    ),
  ]);
}

function renderRelationships(claim: Claim, options: RenderOptions): Html {
  const parent = claim.record.parentClaim;
  const children = options.children ?? [];
  if (!parent && children.length === 0 && !claim.record.supersedes && !options.supersededBy) return empty;

  const rows: Html[] = [];
  const claimLink = (id: string, label: string) => el('span', {}, escapeText(label), escapeText(' '), el('span', { class: 'claim-id' }, escapeText(id)));

  if (parent && claim.record.edgeType) {
    rows.push(metaRow('Belongs to', join([term(claim.record.edgeType), escapeText(' — '), claimLink(parent, 'parent claim')])));
  }
  for (const child of children) {
    rows.push(metaRow('Sub-claim', join([term(child.edgeType), escapeText(' — '), claimLink(child.id, child.restatement)])));
  }
  if (claim.record.supersedes) {
    rows.push(
      metaRow(
        'Supersedes',
        join([
          claimLink(claim.record.supersedes, 'an earlier wording of this claim'),
          escapeText(`, confirmed by ${claim.record.supersedesConfirmedBy ?? 'unrecorded'}`),
        ]),
      ),
    );
  }
  if (options.supersededBy) {
    rows.push(metaRow('Superseded by', claimLink(options.supersededBy.id, options.supersededBy.restatement)));
  }

  return join([el('h2', {}, escapeText('Related claims')), el('dl', { class: 'meta' }, join(rows))]);
}

function renderOrigin(run: StoredRun, originId: string, group: string): Html {
  const ledger = run.ledger as NonNullable<StoredRun['ledger']>;
  const origin = ledger.origins.find((o) => o.id === originId);
  const warrant = ledger.warrants.find((w) => w.originId === originId);
  if (!origin || !warrant) return empty;

  const facts: Html[] = [
    fact('Evidence type', term(warrant.startingGrade)),
    fact('Source record', term(warrant.sourceReliabilityGrade)),
    fact('Retrieval', term(origin.retrievalStatus)),
  ];
  if (warrant.interestedParty) {
    facts.push(el('li', { class: 'fact' }, escapeText('Interested party')));
  }
  if (origin.retracted) {
    facts.push(el('li', { class: 'fact' }, escapeText('Retracted')));
  }

  const triggers = warrant.firedTriggers.map((t) =>
    el('li', {}, join([term(t.direction), escapeText(` — ${t.mechanism}`)])),
  );

  return el(
    'div',
    { class: `origin ${group}` },
    el('p', { class: 'origin-url' }, link(origin.id, origin.id)),
    el('ul', { class: 'facts' }, join(facts)),
    triggers.length > 0
      ? join([el('h4', {}, escapeText('Adjustments applied to this source')), el('ul', {}, join(triggers))])
      : empty,
  );
}

/**
 * Two different facts, both about which sources were allowed to count.
 *
 * The first is what the deterministic registry gate refused during the run — an
 * exclusion is recorded and shown rather than dropped, because a filter nobody
 * can inspect is indistinguishable from a bug.
 *
 * The second is a source that IS in the ledger but would not be admitted today.
 * That happens when the registry grows after a record was written, and saying so
 * is more honest than either hiding it or deleting the record.
 */
function renderSourceGate(run: StoredRun): Html {
  const excluded = run.trace?.excludedSources ?? [];
  const violations = blockedOriginsIn(run);
  if (excluded.length === 0 && violations.length === 0) return empty;

  const excludedBlock =
    excluded.length === 0
      ? empty
      : join([
          el('h3', {}, escapeText(`Sources refused before they could count (${excluded.length})`)),
          el(
            'p',
            { class: 'group-note' },
            escapeText(
              'The search turned these up and a deterministic check refused them before anything was fetched or ' +
                'graded. They are listed because a filter nobody can see is indistinguishable from a bug.',
            ),
          ),
          el(
            'ul',
            {},
            join(
              excluded.map((e) =>
                el('li', {}, el('span', { class: 'origin-url' }, link(e.url, e.url)), escapeText(` — ${e.reason}`)),
              ),
            ),
          ),
        ]);

  const violationBlock =
    violations.length === 0
      ? empty
      : notice(
          'A source in this record would not be admitted today.',
          join([
            el(
              'p',
              {},
              escapeText(
                'The source registry has been extended since this run was recorded. The evidence below still ' +
                  'includes a domain that the current rules classify as an aggregator, which means it would now be ' +
                  'refused before it could count toward anything. The record is shown unchanged rather than edited ' +
                  'or withdrawn.',
              ),
            ),
            el('ul', {}, join(violations.map((v) => el('li', {}, escapeText(`${v.url} — ${v.reason}`))))),
          ]),
        );

  return join([el('h2', {}, escapeText('Which sources were allowed to count')), violationBlock, excludedBlock]);
}

function renderLedger(run: StoredRun): Html {
  const ledger = run.ledger;
  if (!ledger) return empty;

  const markFor = (originId: string): string => {
    const entry = ledger.diagnosticityEntries.find((e) => e.lineOriginId === originId && e.against === 'claim');
    return entry?.mark ?? 'not_applicable';
  };

  const groups: { key: string; css: string; heading: string; note: string }[] = [
    { key: 'consistent', css: 'supports', heading: 'Supports the claim', note: 'What these sources show is what you would expect if the claim were true.' },
    { key: 'inconsistent', css: 'opposes', heading: 'Contradicts the claim', note: 'What these sources show is not what you would expect if the claim were true.' },
    {
      key: 'not_applicable',
      css: 'neither',
      heading: 'Bears on neither',
      note: 'These sources do not distinguish the claim being true from it being false, so they count toward nothing in either direction.',
    },
  ];

  const sections = groups.map((g) => {
    const ids = ledger.origins.map((o) => o.id).filter((id) => markFor(id) === g.key);
    if (ids.length === 0) return empty;
    return join([
      el('p', { class: 'group-label' }, escapeText(`${g.heading} (${ids.length})`)),
      el('p', { class: 'group-note' }, escapeText(g.note)),
      join(ids.map((id) => renderOrigin(run, id, g.css))),
    ]);
  });

  const nothing = ledger.origins.length === 0 ? el('p', {}, escapeText('No sources were recorded for this run.')) : empty;

  return join([
    el('h2', {}, escapeText('The evidence')),
    el(
      'p',
      {},
      escapeText(
        'Every source the run retrieved is listed, including those that could not be fetched — a source nobody ' +
          'could read is shown and counted as a bare assertion rather than quietly dropped.',
      ),
    ),
    nothing,
    join(sections),
  ]);
}

function renderRivals(run: StoredRun): Html {
  const rivals = run.ledger?.rivals ?? [];
  if (rivals.length === 0) return empty;
  const rows = rivals.map((r) =>
    el(
      'tr',
      {},
      el('td', {}, escapeText(r.description)),
      el('td', {}, term(r.plausibilityRelativeToClaim)),
      el('td', {}, escapeText(r.rebutted ? 'Rebutted by the evidence' : 'Still standing')),
    ),
  );
  return join([
    el('h2', {}, escapeText('Alternative explanations')),
    el('p', {}, escapeText('Competing accounts a thoughtful skeptic might raise, and whether the evidence ruled each one out.')),
    el(
      'div',
      { class: 'scroll-x' },
      el(
        'table',
        {},
        el('thead', {}, el('tr', {}, el('th', {}, escapeText('Alternative')), el('th', {}, escapeText('Plausibility')), el('th', {}, escapeText('Status')))),
        el('tbody', {}, join(rows)),
      ),
    ),
  ]);
}

function renderConditions(run: StoredRun): Html {
  const v = run.recordedVerdict;
  if (!v) return empty;
  const list = (items: { id: string; protocolClause: string }[]): Html =>
    items.length === 0
      ? el('p', {}, escapeText('None recorded.'))
      : el(
          'ul',
          {},
          join(
            items.map((c) =>
              el('li', {}, el('span', { class: 'term-code' }, escapeText(`${c.id} `)), escapeText(c.protocolClause)),
            ),
          ),
        );
  return join([
    el('h2', {}, escapeText('Why the engine landed here')),
    el('h3', {}, escapeText('Conditions that were met')),
    list(v.conditionsMet),
    el('h3', {}, escapeText('Conditions that held the band down')),
    list(v.cappingConditions),
    el(
      'p',
      { class: 'claim-id' },
      escapeText(
        `Decided on ${has(v.tree) ? lookup(v.tree).plain : v.tree}. Each identifier above names a specific rule in the ` +
          'protocol, so a challenge can cite the exact condition it disputes.',
      ),
    ),
  ]);
}

function renderTrace(run: StoredRun): Html {
  const trace = run.trace;
  if (!trace) return empty;

  const steps = trace.steps.map((s) =>
    el('li', {}, el('span', { class: 'mono' }, escapeText(s.step)), escapeText(` — ${UTC(s.timestamp)}`)),
  );

  // FR-020: every attempt, including the failures. A trace that shows only what
  // worked is not a trace.
  const attempts = trace.remediationAttempts.map((a) =>
    el(
      'li',
      { class: a.succeeded ? 'attempt-ok' : 'attempt-failed' },
      el('span', { class: 'mono' }, escapeText(`${a.step} · attempt ${a.attemptNumber}`)),
      escapeText(a.succeeded ? ' — accepted' : ` — rejected: ${a.violation ?? 'no reason recorded'}`),
    ),
  );
  const failures = trace.remediationAttempts.filter((a) => !a.succeeded).length;

  return join([
    el('h2', {}, escapeText('How the run proceeded')),
    el('h3', {}, escapeText('Steps, in order')),
    el('ol', { class: 'trace' }, join(steps)),
    el('h3', {}, escapeText('Every attempt each step needed')),
    el(
      'p',
      { class: 'group-note' },
      escapeText(
        failures === 0
          ? 'Every step produced valid output on its first attempt.'
          : `${failures} attempt(s) were rejected and retried. Failed attempts are listed because a trace showing only what worked is not a trace.`,
      ),
    ),
    el('ol', { class: 'trace' }, join(attempts)),
  ]);
}

function renderOutcome(run: StoredRun): Html {
  const outcome = run.outcome;
  if (!outcome) return empty;
  return join([
    el('h2', {}, escapeText('Outcome')),
    notice(
      'This claim has no verdict.',
      join([
        el('p', {}, escapeText(outcome.summary)),
        el('ul', {}, join(outcome.detail.map((d) => el('li', {}, escapeText(d))))),
      ]),
    ),
    el(
      'p',
      {},
      escapeText(
        'No band is shown because none was computed. This is a record of what happened to the claim, not a finding ' +
          'that it is true or false.',
      ),
    ),
  ]);
}

function renderAuthored(claim: Claim): Html {
  const blocks: Html[] = [];
  if (claim.record.body.trim().length > 0) {
    blocks.push(
      el(
        'div',
        { class: 'authored' },
        el('p', { class: 'provenance-label' }, escapeText('Written by a contributor · not generated')),
        renderMarkdown(claim.record.body),
      ),
    );
  }
  for (const file of claim.supplementary) {
    blocks.push(
      el(
        'div',
        { class: 'authored' },
        el('p', { class: 'provenance-label' }, escapeText(`Written by a contributor · ${file.filename}`)),
        renderMarkdown(file.body),
      ),
    );
  }
  if (blocks.length === 0) return empty;
  return join([el('h2', {}, escapeText('Contributor notes')), join(blocks)]);
}

/** Every protocol term the page could show, defined on the page itself
 * (FR-015b). Engine condition ids are exempt: they are not enumerable ahead of
 * time and each already carries its own protocol clause beside it. */
function renderGlossary(used: Set<string>): Html {
  const terms: VocabularyTerm[] = allTerms().filter((t) => used.has(t.term));
  if (terms.length === 0) return empty;
  const rows = terms.flatMap((t) => [
    el('dt', {}, escapeText(`${t.plain} (${t.term})`)),
    el('dd', {}, escapeText(t.definition)),
  ]);
  return join([el('h2', {}, escapeText('What these terms mean')), el('dl', { class: 'glossary' }, join(rows))]);
}

/** Collects every vocabulary term this page will render, so the glossary covers
 * exactly what appears — no more, no less. */
function collectTerms(claim: Claim, run: StoredRun | undefined): Set<string> {
  const used = new Set<string>();
  const add = (t: string | null | undefined) => {
    if (t && has(t)) used.add(t);
  };
  if (claim.record.edgeType) add(claim.record.edgeType);
  if (claim.record.supersedes) add('supersedes');
  if (!run) return used;

  const v = run.recordedVerdict;
  if (v) {
    add(v.band);
    add(v.qualifier);
    add(v.tree);
    const current = displayedVerdict(run)?.currentBand;
    add(current);
  }
  const ledger = run.ledger;
  if (ledger) {
    add(ledger.classification.primary);
    add(ledger.classification.alternative);
    add(ledger.screens.falsifiability);
    add(ledger.screens.priorPlausibility);
    add(ledger.adversarialStatus);
    for (const o of ledger.origins) add(o.retrievalStatus);
    for (const w of ledger.warrants) {
      add(w.startingGrade);
      add(w.sourceReliabilityGrade);
      for (const t of w.firedTriggers) add(t.direction);
    }
    for (const e of ledger.diagnosticityEntries) add(e.mark);
    for (const r of ledger.rivals) add(r.plausibilityRelativeToClaim);
  }
  return used;
}

export function renderClaimPage(claim: Claim, options: RenderOptions = {}): string {
  const run = claim.runs[0];
  // The single permitted piece of non-determinism on the page, and the reason
  // FR-030 says "byte-identical apart from an explicitly-stamped generation
  // timestamp" rather than "byte-identical". It appears exactly once, in the
  // footer, labelled as generation time so it can never be mistaken for when
  // the run happened. Every test passes generatedAt explicitly so the property
  // is actually checkable.
  // eslint-disable-next-line no-restricted-syntax -- the stamped generation time; see above
  const generatedAt = options.generatedAt ?? new Date().toISOString();

  if (!run) {
    const body = el(
      'main',
      {},
      renderHeader(claim),
      notice(
        'This claim has not been evaluated yet.',
        el('p', {}, escapeText('It is recorded in the corpus but holds no run, so there is nothing to report.')),
      ),
      renderRelationships(claim, options),
      renderAuthored(claim),
      el('footer', {}, escapeText(`Generated ${UTC(generatedAt)}.`)),
    );
    return htmlDocument(claim.record.canonicalRestatement ?? claim.id, PAGE_STYLE, body);
  }

  // research.md §6: a harm-gate rejection publishes the rule that fired and
  // nothing of the claim itself. Republishing an allegation the intake gate
  // refused would have the platform perform the exact harm it declined.
  const isRejection = claim.record.claimKind === 'rejection';
  const used = collectTerms(claim, run);

  const body = el(
    'main',
    {},
    renderHeader(claim),
    isRejection
      ? renderOutcome(run)
      : join([
          run.kind === 'completed' ? renderVerdict(run) : renderOutcome(run),
          run.kind === 'completed' ? renderStability(claim, run) : empty,
          renderProvenance(run),
          renderRelationships(claim, options),
          run.kind === 'completed' ? renderSourceGate(run) : empty,
          run.kind === 'completed' ? renderLedger(run) : empty,
          run.kind === 'completed' ? renderRivals(run) : empty,
          run.kind === 'completed' ? renderConditions(run) : empty,
          renderTrace(run),
          renderAuthored(claim),
          renderGlossary(used),
        ]),
    el(
      'footer',
      {},
      escapeText(`Generated ${UTC(generatedAt)} from ${run.file}. `),
      escapeText('Regenerate with: node --import tsx src-corpus/cli.ts '),
      el('span', { class: 'mono' }, escapeText(claim.id)),
    ),
  );

  return htmlDocument(claim.record.canonicalRestatement ?? claim.id, PAGE_STYLE, body);
}

export { isEngineConditionId };
