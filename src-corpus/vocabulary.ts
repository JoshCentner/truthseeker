/**
 * The single source of plain-language wording for every protocol term
 * (FR-015a/b/c).
 *
 * The rule the spec settled on is that plain language LEADS and the protocol
 * term stays beside it — never replaces it. Paraphrasing a term away would make
 * the page unciteable, and the constitution requires that a reader be able to
 * challenge one named field. So a page shows "Instrument or documentary record
 * (physical_documentary)", not one or the other.
 *
 * A term with no entry here is a generation error, not a fallback to the bare
 * identifier (SC-001c). A page that prints `T1-CAP-UNREBUTTED-RIVAL` at a reader
 * with no explanation has failed the audience the spec names.
 */

export interface VocabularyTerm {
  term: string;
  plain: string;
  definition: string;
}

export class UnknownTermError extends Error {
  constructor(term: string) {
    super(
      `No plain-language definition for protocol term "${term}". Every term rendered on a page must ` +
        `have an entry in src-corpus/vocabulary.ts (SC-001c) — a bare identifier is not readable by ` +
        `the audience this page is for.`,
    );
  }
}

function entries(list: VocabularyTerm[]): Map<string, VocabularyTerm> {
  return new Map(list.map((t) => [t.term, t]));
}

/** Bands. These additionally appear with their definition inline at the band
 * itself (FR-014), not only in the glossary. */
export const BANDS = entries([
  {
    term: 'established',
    plain: 'Established',
    definition:
      'Multiple independent lines of strong evidence agree, nothing surviving contradicts it, and the strongest evidence held up when actively attacked. Act on it.',
  },
  {
    term: 'probable',
    plain: 'Probable',
    definition:
      'The evidence meets the same shape as Established but one condition falls short — most often that the strongest evidence has not been adversarially tested. Act on it, but expect it to move.',
  },
  {
    term: 'contested',
    plain: 'Contested',
    definition:
      'The evidence does not settle the question. Either it is too thin to support the claim, or credible evidence points both ways. Not a verdict of false — a verdict of unresolved.',
  },
  {
    term: 'doubtful',
    plain: 'Doubtful',
    definition: 'The evidence leans against the claim without meeting the bar required to call it refuted.',
  },
  {
    term: 'unsupported',
    plain: 'Unsupported',
    definition:
      'Nothing that survives scrutiny supports the claim. This is a statement about the absence of support, not a finding that the claim is false — the burden rests on whoever makes a claim.',
  },
  {
    term: 'refuted',
    plain: 'Refuted',
    definition:
      'Evidence against the claim clears the same bar that establishing it would require: two or more independent lines at documentary strength or better. The claim is false, not merely unsupported.',
  },
  {
    term: 'unresolvable',
    plain: 'Unresolvable',
    definition:
      'The claim cannot be honestly banded — typically a complex-system claim that cannot be decomposed into parts that can each be assessed.',
  },
  {
    term: 'unfalsifiable',
    plain: 'Unfalsifiable',
    definition: 'No observation could show the claim false, so evidence cannot bear on it at all.',
  },
]);

export const QUALIFIERS = entries([
  {
    term: 'insufficient_evidence',
    plain: 'not enough evidence',
    definition: 'The band is held where it is by a shortage of evidence rather than by evidence pointing the other way.',
  },
  {
    term: 'conflicting_evidence',
    plain: 'evidence points both ways',
    definition:
      'Evidence for and against matched each other on both strength and independence, so the disagreement is real rather than a gap.',
  },
]);

export const WARRANT_GRADES = entries([
  {
    term: 'physical_documentary',
    plain: 'Instrument or documentary record',
    definition:
      'A physical artifact, instrument reading, signed document or raw footage — or a re-testable result whose data and method are published so anyone can re-run it. The strongest kind of evidence.',
  },
  {
    term: 'contemporaneous_record',
    plain: 'Record made at the time',
    definition: 'A log, minute or filing created as events happened, before any dispute existed to shade it.',
  },
  {
    term: 'testimony',
    plain: 'First-hand account',
    definition: 'Someone reporting what they directly experienced. Real evidence, but weaker than a record made at the time.',
  },
  {
    term: 'assertion',
    plain: 'Bare assertion',
    definition:
      'A statement with nothing underneath it. Carries zero weight no matter how many sources repeat it — repetition is not corroboration.',
  },
]);

export const RELIABILITY_GRADES = entries([
  { term: 'reliable', plain: 'Strong track record', definition: 'This source has a verifiable record of accuracy.' },
  { term: 'mixed', plain: 'Mixed track record', definition: 'This source is accurate sometimes and not others.' },
  {
    term: 'not_rated',
    plain: 'Track record unknown',
    definition: 'Nothing verifiable is known about this source’s accuracy. The default — not a criticism.',
  },
  { term: 'poor', plain: 'Poor track record', definition: 'This source has a demonstrated record of getting things wrong.' },
  {
    term: 'fabricator',
    plain: 'Has fabricated before',
    definition:
      'This source has at least one demonstrated intentional invention, forgery or staging. Never assigned for good-faith error.',
  },
]);

export const DIAGNOSTIC_MARKS = entries([
  { term: 'consistent', plain: 'Supports the claim', definition: 'What this source shows is what you would expect if the claim were true.' },
  { term: 'inconsistent', plain: 'Contradicts the claim', definition: 'What this source shows is not what you would expect if the claim were true.' },
  {
    term: 'not_applicable',
    plain: 'Bears on neither',
    definition:
      'This source does not distinguish between the claim being true and being false. It counts toward nothing, in either direction.',
  },
]);

export const RETRIEVAL_STATUSES = entries([
  { term: 'retrieved', plain: 'Retrieved', definition: 'The page was fetched and its content was read.' },
  {
    term: 'could_not_retrieve',
    plain: 'Could not retrieve',
    definition:
      'The page could not be fetched — blocked, paywalled, behind a consent wall, or gone. It is shown anyway, and graded as a bare assertion, so a source nobody could read never quietly props up a verdict.',
  },
]);

export const EDGE_TYPES = entries([
  {
    term: 'load_bearing',
    plain: 'Load-bearing sub-claim',
    definition: 'The parent claim depends on this one. If this falls, the parent falls with it.',
  },
  {
    term: 'supplementary',
    plain: 'Supplementary sub-claim',
    definition: 'Related to the parent claim and recorded alongside it, but the parent does not depend on it.',
  },
  {
    term: 'supersedes',
    plain: 'Supersedes',
    definition:
      'This claim replaces an earlier wording. The earlier claim stays published with its evidence intact, because citations made against it must not break.',
  },
]);

export const ADVERSARIAL_STATUSES = entries([
  {
    term: 'survived',
    plain: 'Survived attack',
    definition: 'The strongest evidence was actively attacked and no genuine weakness was found.',
  },
  {
    term: 'untested',
    plain: 'Not confirmed under attack',
    definition:
      'Either no evidence was strong enough to be worth attacking, or the attack found a real weakness. Both mean the same thing for the verdict: the evidence has not been shown to hold up.',
  },
]);

export const TRIGGER_DIRECTIONS = entries([
  {
    term: 'downgrade',
    plain: 'Weakens this evidence',
    definition: 'A safeguard was missing, and a specific mechanism was named by which its absence could produce this result even if the claim were false.',
  },
  { term: 'upgrade', plain: 'Strengthens this evidence', definition: 'An independent replication or a timestamped prior commitment was verified.' },
]);

export const MISC = entries([
  { term: 'ordinary', plain: 'Ordinary claim', definition: 'The claim does not contradict settled background knowledge.' },
  {
    term: 'extraordinary',
    plain: 'Extraordinary claim',
    definition:
      'The claim contradicts settled background knowledge, which raises the evidence required to support it — it does not reject the claim.',
  },
  { term: 'pass', plain: 'Passed', definition: 'This screen did not fire.' },
  { term: 'fired', plain: 'Fired', definition: 'This screen fired and stopped the claim from being evaluated further.' },
  { term: 'none', plain: 'None', definition: 'No finding of this kind was recorded.' },
  { term: 'simple_factual', plain: 'Simple factual claim', definition: 'A claim about what is or was the case, assessed on Tree 1.' },
  { term: 'causal', plain: 'Causal claim', definition: 'A claim that one thing caused another, assessed on Tree 2.' },
  { term: 'predictive', plain: 'Predictive claim', definition: 'A claim about the future, assessed on Tree 3.' },
  {
    term: 'complex_system',
    plain: 'Complex-system claim',
    definition: 'A claim about a multi-causal adaptive system where mechanisms are disputed among experts, assessed on Tree 4.',
  },
  { term: 'tree1_simple_factual', plain: 'Tree 1 (simple factual)', definition: 'The decision tree for claims about what is or was the case.' },
  { term: 'tree2_causal', plain: 'Tree 2 (causal)', definition: 'The decision tree for claims that one thing caused another.' },
  { term: 'tree3_predictive', plain: 'Tree 3 (predictive)', definition: 'The decision tree for claims about the future. Cannot reach Established.' },
  { term: 'tree4_complex_system', plain: 'Tree 4 (complex system)', definition: 'The decision tree for claims about multi-causal adaptive systems.' },
  { term: 'aggregation', plain: 'Aggregation', definition: 'The band was computed by combining sub-claim bands rather than from evidence directly.' },
  { term: 'screen', plain: 'Screen', definition: 'The claim was stopped by an intake screen before any tree ran.' },
  { term: 'more_plausible', plain: 'More plausible than the claim', definition: 'On general reasoning alone, this alternative explanation looks likelier than the claim itself.' },
  { term: 'less_or_equally_plausible', plain: 'No more plausible than the claim', definition: 'On general reasoning alone, this alternative looks no likelier than the claim.' },
]);

const ALL: Map<string, VocabularyTerm> = new Map([
  ...BANDS,
  ...QUALIFIERS,
  ...WARRANT_GRADES,
  ...RELIABILITY_GRADES,
  ...DIAGNOSTIC_MARKS,
  ...RETRIEVAL_STATUSES,
  ...EDGE_TYPES,
  ...ADVERSARIAL_STATUSES,
  ...TRIGGER_DIRECTIONS,
  ...MISC,
]);

/** Throws rather than falling back — a bare identifier on the page is the
 * failure this exists to prevent (SC-001c). */
export function lookup(term: string): VocabularyTerm {
  const found = ALL.get(term);
  if (!found) throw new UnknownTermError(term);
  return found;
}

export function has(term: string): boolean {
  return ALL.has(term);
}

/** Engine condition ids (T1-ESTABLISHED, T2-CAP-INHERIT, …) are not enumerable
 * ahead of time: the engine may add one at any release, and each carries its own
 * protocol clause in the verdict. They are rendered with that clause as their
 * explanation, which is why they are exempt from the vocabulary requirement. */
export function isEngineConditionId(term: string): boolean {
  return /^(T[1-4]|SCREEN|CAP|AGG)[-A-Z0-9]*$/.test(term);
}

export function allTerms(): VocabularyTerm[] {
  return [...ALL.values()].sort((a, b) => a.term.localeCompare(b.term));
}
