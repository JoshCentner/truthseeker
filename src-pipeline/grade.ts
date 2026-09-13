import type { LlmClient } from './llm-client.js';
import type { GradingRubric, GradingOutput, RetrievedOrigin } from './types.js';
import type { WarrantGrade, ReliabilityGrade, FiredTrigger } from '../src/index.js';
import { wrapUntrustedContent, detectInstructionEcho } from './contain.js';

/**
 * FR-020: verbatim from AGENT-PROTOCOL-v3.md Step 3 — not a paraphrase. The
 * grading call receives this rubric and an origin's content; it never
 * receives a claim, ledger state, or which side this origin is meant to
 * support (research.md §6 — enforced by gradeOrigin's own signature below,
 * not just by this instruction).
 */
export const DEFAULT_GRADING_RUBRIC: GradingRubric = {
  text: `Grade this origin's evidentiary warrant per the following rubric. Answer honestly from the
content alone — you have not been told what claim this evidence relates to, and you must not
guess or ask; grade the origin on its own terms.

Primary warrant hierarchy (best to worst):
1. Re-testable / reproducible (data and method available; anyone can re-run it)
2. Physical or documentary record (artifact, instrument reading, signed contract, raw footage)
3. Contemporaneous record (made at the time, before any dispute existed: logs, minutes, filings)
4. Testimony (first-person account of direct experience)
5. Bare assertion (a statement with nothing beneath it)

Derivative artifacts (inferences, expert summaries, meta-analyses, reviews) are not warrant types:
trace through them and grade what they rest on. A dead-end derivative never outranks testimony.

Zero-weight rule: bare assertion carries zero weight at any volume.

Downgrade triggers — a trigger fires only when a safeguard is missing AND you can name the
specific mechanism by which that missing safeguard could produce the claimed result even if it
were false. Record the mechanism for every fired trigger. One grade step per fired trigger, no
limit.
- D1 Methodological weakness: (a) comparison/control condition? (b) measurement blinded,
  automated, or independently verified? (c) sample/case selection method stated and non-arbitrary?
  (d) outcomes specified before results were known? For (c) and (d), "cannot determine" counts as
  "no".
- D2 Imprecision presented as precision: specific quantity with no stated interval; or interval
  includes values that change the meaning; or sample too small for the specificity claimed.
- D3 Indirectness: evidence measures a proxy, and the proxy's link to the thing itself is not
  independently established.
- D4 Internal inconsistency: the source contradicts itself on a material point, or its conclusion
  does not follow from its own data.

Upgrade triggers (verify, never presume): independent replication (separate team, own data
collection, retrievable); pre-registration or equivalent timestamped prior commitment. Upgrades
cannot move evidence above physical/documentary grade.

Interested party (the source gains materially, reputationally, politically, or legally if this
content is believed):
- Re-testable / physical: no discount; note the interest.
- Contemporaneous record: no discount if created before any dispute existed or outside the
  party's control; if the party controlled its creation after stakes were visible, treat as
  testimony.
- Testimony: treated as assertion for carrying a claim; corroboration value only.
- Assertion: zero, as always.

Source-reliability grade, from what you can verify about this specific source: Strong / Mixed /
Unknown (the default when you cannot verify a track record) / Poor / Fabricator (at least one
demonstrated intentional invention, forgery, or staging — never assigned for good-faith error).

Respond with exactly one JSON object, no other text:
{
  "startingGrade": "re_testable" | "physical_documentary" | "contemporaneous_record" | "testimony" | "assertion",
  "firedTriggers": [{ "direction": "downgrade" | "upgrade", "mechanism": "<specific mechanism, required>" }],
  "interestedParty": boolean,
  "partyControlledCreationAfterStakesVisible": boolean,
  "sourceReliabilityGrade": "Strong" | "Mixed" | "Unknown" | "Poor" | "Fabricator",
  "reasoning": "<brief explanation, for audit only>"
}`,
};

interface RawGradingResponse {
  startingGrade: 're_testable' | 'physical_documentary' | 'contemporaneous_record' | 'testimony' | 'assertion';
  firedTriggers: { direction: 'downgrade' | 'upgrade'; mechanism?: string }[];
  interestedParty: boolean;
  partyControlledCreationAfterStakesVisible: boolean;
  sourceReliabilityGrade: 'Strong' | 'Mixed' | 'Unknown' | 'Poor' | 'Fabricator';
  reasoning?: string;
}

/** FR-024: the protocol's 5-tier hierarchy collapses onto 001's 4-tier
 * WarrantGrade — re_testable and physical_documentary both map to 001's
 * single physical_documentary, matching how 001's own extraordinary-claim
 * logic already treats that combined tier (FR-031 of 001). */
function mapStartingGrade(raw: RawGradingResponse['startingGrade']): WarrantGrade {
  if (raw === 're_testable' || raw === 'physical_documentary') return 'physical_documentary';
  return raw;
}

/** Naming mismatch discovered during implementation: the protocol's own
 * reliability vocabulary (Strong/Mixed/Unknown/Poor/Fabricator) doesn't match
 * 001's ReliabilityGrade enum (reliable/mixed/not_rated/poor/fabricator)
 * verbatim — this maps between them. */
function mapReliabilityGrade(raw: RawGradingResponse['sourceReliabilityGrade']): ReliabilityGrade {
  switch (raw) {
    case 'Strong':
      return 'reliable';
    case 'Mixed':
      return 'mixed';
    case 'Unknown':
      return 'not_rated';
    case 'Poor':
      return 'poor';
    case 'Fabricator':
      return 'fabricator';
  }
}

/** FR-021: a trigger without a named mechanism is not a valid fired trigger —
 * dropped rather than silently accepted, since accepting it would let a
 * grade move without the accountability the protocol requires. */
function filterTriggersRequiringMechanism(raw: RawGradingResponse['firedTriggers']): FiredTrigger[] {
  return raw
    .filter((t) => typeof t.mechanism === 'string' && t.mechanism.trim().length > 0)
    .map((t) => ({ direction: t.direction, mechanism: t.mechanism as string }));
}

/**
 * FR-020, FR-022: no claim parameter exists in this signature — a compile-
 * time guarantee, not a runtime promise (research.md §6). FR-022: content
 * being null short-circuits to bare assertion without an LLM call at all.
 * FR-025: the upgrade-above-physical_documentary cap is enforced downstream
 * in 001's own src/normalize/weight.ts (stepUp() clamps at that grade
 * regardless of how many upgrade triggers fire) — not re-implemented here,
 * to avoid two places disagreeing about where the ceiling is.
 */
export async function gradeOrigin(
  origin: RetrievedOrigin,
  llm: LlmClient,
  rubric: GradingRubric = DEFAULT_GRADING_RUBRIC,
): Promise<GradingOutput> {
  if (origin.content === null) {
    return {
      startingGrade: 'assertion',
      firedTriggers: [],
      interestedParty: false,
      partyControlledCreationAfterStakesVisible: false,
      sourceReliabilityGrade: 'not_rated',
      rawModelReasoning: 'origin could not be retrieved — graded as bare assertion without an LLM call (FR-022)',
    };
  }

  // FR-037/FR-038: an aggregator-classed origin gets its classification
  // stated explicitly, rather than relying solely on the model inferring it
  // from content alone — this makes the rubric's existing "trace through
  // derivative artifacts" instruction a structural input, not a hope. Real
  // automated retrieval-and-substitution of the specific original document an
  // aggregator cites is a further enhancement (PROJECT-TRACKER.md), not built
  // in this MVP.
  const registryNote =
    origin.registryClass === 'aggregator'
      ? "\n\nNOTE: this source is a known AGGREGATOR — it republishes or summarizes other outlets' reporting rather than being the original source. Per the rubric above, trace through to what it actually rests on; do not grade it as if it were the original record."
      : origin.registryClass
        ? `\n\nNOTE: this source is registry-classed as ${origin.registryClass}.`
        : '';

  // FR-017: fetched content reaches the model only inside the delimited,
  // explicitly-untrusted block — never interpolated raw into the prompt.
  const prompt = `${rubric.text}\n\n${wrapUntrustedContent(origin.id, origin.content)}${registryNote}`;
  const response = await llm.generate(prompt);
  const cleaned = response.text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
  const raw: RawGradingResponse = JSON.parse(cleaned);

  // FR-018/FR-019: a fired trigger's mechanism (or the raw reasoning) that
  // echoes directive-shaped language present in the source content is
  // flagged as a provenance finding, surfaced via rawModelReasoning, rather
  // than silently passed through as if it were ordinary grading commentary.
  const echoCheck = detectInstructionEcho(origin.content, `${JSON.stringify(raw.firedTriggers)} ${raw.reasoning ?? ''}`);
  const rawModelReasoning = echoCheck.detected
    ? `${raw.reasoning ?? ''} [INJECTION-ECHO DETECTED: output echoes source phrase(s): ${echoCheck.matchedPhrases.join(', ')}]`
    : (raw.reasoning ?? '');

  return {
    startingGrade: mapStartingGrade(raw.startingGrade),
    firedTriggers: filterTriggersRequiringMechanism(raw.firedTriggers),
    interestedParty: raw.interestedParty,
    partyControlledCreationAfterStakesVisible: raw.partyControlledCreationAfterStakesVisible,
    sourceReliabilityGrade: mapReliabilityGrade(raw.sourceReliabilityGrade),
    rawModelReasoning,
  };
}

const RETRACTION_MARKERS = ["this article has been retracted", "editor's note: this piece was corrected", 'correction:'];

/**
 * FR-023: a lightweight heuristic — genuinely imperfect, same quality bar as
 * retrieve.ts's paywall detection. Origin-level (retraction/correction),
 * deliberately separate from warrant-level grading, matching 001's own type
 * separation between Origin and Warrant.
 */
export function detectRetractionOrCorrection(content: string): { retracted: boolean; noted: boolean } {
  const lower = content.toLowerCase();
  const retracted = lower.includes('this article has been retracted') || lower.includes('this article was retracted');
  const noted = !retracted && RETRACTION_MARKERS.some((m) => lower.includes(m));
  return { retracted, noted };
}
