import { z } from 'zod';
import type { LedgerInput, CompoundInput, Verdict } from './ledger.js';
import { ENGINE_VERSION, SCHEMA_VERSION } from './version.js';

// ---------------------------------------------------------------------------
// Zod schemas mirroring src/schema/ledger.ts exactly (FR-001, FR-004)
// ---------------------------------------------------------------------------

const warrantGrade = z.enum(['assertion', 'testimony', 'contemporaneous_record', 'physical_documentary']);
const reliabilityGrade = z.enum(['fabricator', 'poor', 'mixed', 'reliable', 'not_rated']);
const contaminationChannel = z.enum(['data', 'method', 'institution', 'motive']);
const diagnosticMark = z.enum(['consistent', 'inconsistent', 'not_applicable']);
const adversarialStatus = z.enum(['survived', 'untested']);
const claimType = z.enum(['simple_factual', 'causal', 'predictive', 'complex_system']);
const band = z.enum([
  'established',
  'probable',
  'contested',
  'doubtful',
  'unsupported',
  'refuted',
  'unresolvable',
  'unfalsifiable',
]);

const originSchema = z.object({
  id: z.string().min(1),
  retrievalStatus: z.enum(['retrieved', 'could_not_retrieve']),
  retracted: z.boolean(),
  correctedFormOfId: z.string().nullable(),
});

const firedTriggerSchema = z.object({
  direction: z.enum(['upgrade', 'downgrade']),
  mechanism: z.string().min(1, 'a fired trigger MUST carry a non-empty mechanism (FR-012)'),
});

const warrantSchema = z.object({
  originId: z.string().min(1),
  startingGrade: warrantGrade,
  firedTriggers: z.array(firedTriggerSchema),
  interestedParty: z.boolean(),
  partyControlledCreationAfterStakesVisible: z.boolean(),
  sourceReliabilityGrade: reliabilityGrade,
  channelKeys: z.object({
    data: z.string().nullable(),
    method: z.string().nullable(),
    institution: z.string().nullable(),
    motive: z.string().nullable(),
  }),
});

const rivalSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  rebutted: z.boolean(),
  plausibilityRelativeToClaim: z.enum(['more_plausible', 'less_or_equally_plausible']),
});

const diagnosticityEntrySchema = z.object({
  lineOriginId: z.string().min(1),
  against: z.union([z.literal('claim'), z.object({ rivalId: z.string() })]),
  mark: diagnosticMark,
});

const tree2ExtensionSchema = z.object({
  underlyingFactualBand: band,
  temporalityFinding: z.enum(['established', 'absent']),
  discriminatingCriterionMet: z.boolean(),
  supportiveCriteriaCount: z.number().int().nonnegative(),
});

const tree3ExtensionSchema = z.object({
  meetsEstablishedShapedConditions: z.boolean(),
});

const tree4ExtensionSchema = z.union([
  z.object({ decomposable: z.literal(true), subClaimIds: z.array(z.string()) }),
  z.object({
    decomposable: z.literal(false),
    whyNoHonestBand: z.string(),
    evidenceThatWouldChangeIt: z.string(),
  }),
]);

/** Field names that exist ONLY on Verdict. A LedgerInput payload carrying any of
 * these is refused under FR-003 — it looks like an attempt to pre-populate a
 * computed field. `schemaVersion` is deliberately excluded: it is a legitimate
 * LedgerInput field in its own right (which schema version the ledger conforms
 * to), not something the engine computes. */
const VERDICT_ONLY_KEYS = [
  'band',
  'qualifier',
  'tree',
  'conditionsMet',
  'cappingConditions',
  'engineVersion',
  'dependenceMap',
  'residue',
  'movedBy',
  'refusalReason',
] as const;

const ledgerInputSchema = z
  .object({
    schemaVersion: z.string().min(1),
    claimRestatement: z.string().min(1),
    classification: z.object({
      primary: claimType,
      confidence: z.enum(['high', 'low']),
      alternative: claimType.optional(),
    }),
    screens: z.object({
      falsifiability: z.enum(['pass', 'fired']),
      priorPlausibility: z.enum(['ordinary', 'extraordinary']),
    }),
    origins: z.array(originSchema),
    warrants: z.array(warrantSchema),
    rivals: z.array(rivalSchema),
    diagnosticityEntries: z.array(diagnosticityEntrySchema),
    adversarialStatus,
    silenceFinding: z.enum(['none', 'weak', 'strong']),
    steelman: z.object({ performed: z.boolean(), revisionOccurred: z.boolean() }),
    extraordinaryClusterSurvivedAdversarialTesting: z.boolean().nullable(),
    treeExtension: z.union([tree2ExtensionSchema, tree3ExtensionSchema, tree4ExtensionSchema]).nullable(),
  })
  .strict();

const compoundSubClaimSchema = z.object({
  id: z.string().min(1),
  band,
  edgeType: z.enum(['load_bearing', 'supplementary']),
});

const compoundInputSchema = z
  .object({
    subClaims: z.array(compoundSubClaimSchema),
    edges: z.array(z.object({ from: z.string(), to: z.string() })),
  })
  .strict();

// ---------------------------------------------------------------------------
// Public validation entry points (FR-004, FR-008)
// ---------------------------------------------------------------------------

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/**
 * Validates a raw external payload as LedgerInput. Fails closed (never throws)
 * on: a missing/out-of-range field (FR-004, FR-008), or a Verdict-only key
 * present anywhere at the top level (FR-003).
 */
export function validateLedgerInput(raw: unknown): ValidationResult<LedgerInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'ledger input must be a non-null object' };
  }
  const conflicting = VERDICT_ONLY_KEYS.filter((key) => key in (raw as Record<string, unknown>));
  if (conflicting.length > 0) {
    return {
      ok: false,
      reason: `ledger input carries computed-only field(s) that only the engine may set: ${conflicting.join(', ')}`,
    };
  }
  const parsed = ledgerInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, value: parsed.data as LedgerInput };
}

export function validateCompoundInput(raw: unknown): ValidationResult<CompoundInput> {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, reason: 'compound input must be a non-null object' };
  }
  const parsed = compoundInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, value: parsed.data as CompoundInput };
}

/**
 * Shared refusal convention (FR-008, contracts/engine-api.md): the engine never
 * throws for bad ledger data, it returns a Verdict with refusalReason set and
 * every other field null except the version stamps.
 */
export function makeRefusal(reason: string): Verdict {
  return {
    band: null,
    qualifier: null,
    tree: null,
    conditionsMet: [],
    cappingConditions: [],
    engineVersion: ENGINE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    dependenceMap: null,
    residue: null,
    movedBy: null,
    refusalReason: reason,
  };
}
