import { z } from 'zod';
import { parseFrontmatter } from './frontmatter.js';

/**
 * The authored layer's schema (contracts/claim-record.md).
 *
 * Two rules here do more work than they look like they do.
 *
 * FR-012: an engine-computed field in authored metadata is a hard failure, not
 * an ignored key. If a contributor could write `band: established` and have it
 * silently do nothing, they would reasonably conclude it had worked. Principle
 * I's guarantee — that only code names a band — survives only if the attempt is
 * refused out loud.
 *
 * Unknown keys fail for the same reason one step weaker: a typo'd key that is
 * quietly dropped is a contribution that appears accepted and has no effect.
 */

export const CORPUS_SCHEMA_VERSION = '0.1.0';
const ACCEPTED_SCHEMA_VERSIONS = new Set([CORPUS_SCHEMA_VERSION]);

/** Names that belong to the engine and may never appear in authored text. */
const ENGINE_COMPUTED_FIELDS = [
  'band',
  'qualifier',
  'verdict',
  'tree',
  'conditionsMet',
  'cappingConditions',
  'engineVersion',
  'schemaVersion',
  'dependenceMap',
  'residue',
  'movedBy',
  'refusalReason',
] as const;

export const EDGE_TYPES = ['load_bearing', 'supplementary'] as const;
export type EdgeType = (typeof EDGE_TYPES)[number];

export type ClaimKind = 'claim' | 'rejection';

export interface ClaimRecord {
  corpusSchemaVersion: string;
  claimKind: ClaimKind;
  canonicalRestatement?: string;
  parentClaim?: string;
  edgeType?: EdgeType;
  supersedes?: string;
  supersedesConfirmedBy?: string;
  aliases: string[];
  /** Authored prose beneath the frontmatter. */
  body: string;
}

export class ClaimRecordError extends Error {
  constructor(
    message: string,
    readonly file: string,
    readonly field?: string,
  ) {
    super(`${file}${field ? ` (field "${field}")` : ''}: ${message}`);
  }
}

const schema = z
  .object({
    corpusSchemaVersion: z.string(),
    claimKind: z.enum(['claim', 'rejection']),
    canonicalRestatement: z.string().min(1).optional(),
    parentClaim: z.string().min(1).optional(),
    edgeType: z.enum(EDGE_TYPES).optional(),
    supersedes: z.string().min(1).optional(),
    supersedesConfirmedBy: z.string().min(1).optional(),
    aliases: z.array(z.string().min(1)).optional(),
  })
  .strict();

export function parseClaimRecord(source: string, file: string): ClaimRecord {
  const { data, body } = parseFrontmatter(source, file);

  // FR-012 runs before schema validation so the message names the real problem
  // ("this field belongs to the engine") rather than the generic "unknown key".
  for (const forbidden of ENGINE_COMPUTED_FIELDS) {
    if (forbidden in data) {
      throw new ClaimRecordError(
        'this field is computed by the rule engine and must never be authored by hand. ' +
          'The band a page displays comes from a run record, never from a claim file (FR-012, Principle I).',
        file,
        forbidden,
      );
    }
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.') || undefined;
    const unknown = issue?.code === 'unrecognized_keys';
    throw new ClaimRecordError(
      unknown
        ? `unknown field. Unknown keys are refused rather than ignored, so a typo cannot look like it was accepted. Known fields: ${Object.keys(schema.shape).join(', ')}`
        : (issue?.message ?? 'invalid claim record'),
      file,
      unknown ? ((issue as { keys?: string[] }).keys ?? []).join(', ') : field,
    );
  }

  const value = parsed.data;

  if (!ACCEPTED_SCHEMA_VERSIONS.has(value.corpusSchemaVersion)) {
    throw new ClaimRecordError(
      `unsupported corpus schema version ${JSON.stringify(value.corpusSchemaVersion)}; this build accepts ${[...ACCEPTED_SCHEMA_VERSIONS].join(', ')}`,
      file,
      'corpusSchemaVersion',
    );
  }

  if (value.claimKind === 'claim' && !value.canonicalRestatement) {
    throw new ClaimRecordError('a claim requires canonicalRestatement — it is the claim\'s identity (FR-007)', file, 'canonicalRestatement');
  }

  // research.md §6: a harm-gate rejection must not republish what was rejected.
  if (value.claimKind === 'rejection' && value.canonicalRestatement) {
    throw new ClaimRecordError(
      'a rejection must not carry canonicalRestatement. Publishing the text of a claim the harm gate refused ' +
        'would have the platform perform the exact harm it declined, at greater reach (research.md §6). ' +
        'A rejection publishes the rule that fired, not the allegation.',
      file,
      'canonicalRestatement',
    );
  }

  if ((value.parentClaim === undefined) !== (value.edgeType === undefined)) {
    throw new ClaimRecordError(
      'parentClaim and edgeType must both be present or both absent — an edge without a type, or a type without an edge, is not a relationship',
      file,
      value.parentClaim === undefined ? 'parentClaim' : 'edgeType',
    );
  }

  if (value.supersedes !== undefined && value.supersedesConfirmedBy === undefined) {
    throw new ClaimRecordError(
      'supersedes requires supersedesConfirmedBy. Linking two claims whose restatements are not byte-identical ' +
        'must be confirmed by a human and can never be inferred from similarity (FR-007b).',
      file,
      'supersedesConfirmedBy',
    );
  }

  return {
    corpusSchemaVersion: value.corpusSchemaVersion,
    claimKind: value.claimKind,
    canonicalRestatement: value.canonicalRestatement,
    parentClaim: value.parentClaim,
    edgeType: value.edgeType,
    supersedes: value.supersedes,
    supersedesConfirmedBy: value.supersedesConfirmedBy,
    aliases: value.aliases ?? [],
    body,
  };
}
