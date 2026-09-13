import type { LlmClient } from './llm-client.js';
import type { ClaimType } from '../src/index.js';
import { remediate, type RemediationResult } from './remediate.js';

export interface ClassificationResult {
  primary: ClaimType;
  confidence: 'high' | 'low';
  alternative?: ClaimType;
  isExtraordinary: boolean;
}

/**
 * A gap surfaced while writing assemble-ledger.ts: the original spec covers
 * the harm gate's falsifiability rejection (FR-003) but never explicitly
 * assigned a step to Step 1's claim-type classification and extraordinary-
 * claim flag, both of which the ledger's `classification`/`screens` fields
 * require. Added here rather than left implicit.
 */
const CLASSIFY_PROMPT = (claim: string, violation?: string): string => {
  const base = `Classify this claim per AGENT-PROTOCOL-v3.md Step 1:

Claim: ${JSON.stringify(claim)}

Type (in this order of precedence):
- Asserts X caused Y (even implicitly)? -> causal
- Asserts something about the future? -> predictive
- Concerns a multi-causal adaptive system (economy, society, ecosystem, war) where mechanisms are disputed even among experts? -> complex_system
- Otherwise -> simple_factual

Rate confidence high/low. If two types are genuinely plausible, name both.

Also flag EXTRAORDINARY: does the claim contradict settled background knowledge (settled physics,
arithmetic, uncontested public record)? This does not reject the claim — it raises the evidentiary
bar later in the pipeline.

Respond with exactly one JSON object, no other text:
{ "primary": "simple_factual" | "causal" | "predictive" | "complex_system", "confidence": "high" | "low", "alternative": "<same enum, omit if not applicable>", "isExtraordinary": boolean }`;
  return violation
    ? `${base}\n\nYour previous response was invalid: ${violation}\nRespond again, correcting exactly that issue.`
    : base;
};

const VALID_CLAIM_TYPES: ClaimType[] = ['simple_factual', 'causal', 'predictive', 'complex_system'];

/** FR-040 (amendment): validates the claim-type enum and confidence value —
 * previously this was a naive cast with no runtime check at all. */
function validateClassification(raw: unknown): { ok: true; value: ClassificationResult } | { ok: false; violation: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, violation: 'response was not a JSON object' };
  }
  const r = raw as Partial<ClassificationResult>;
  if (typeof r.primary !== 'string' || !VALID_CLAIM_TYPES.includes(r.primary)) {
    return { ok: false, violation: `"primary" must be one of ${VALID_CLAIM_TYPES.join(', ')}, got ${JSON.stringify(r.primary)}` };
  }
  if (r.confidence !== 'high' && r.confidence !== 'low') {
    return { ok: false, violation: '"confidence" must be exactly "high" or "low"' };
  }
  if (r.alternative !== undefined && !VALID_CLAIM_TYPES.includes(r.alternative)) {
    return { ok: false, violation: `"alternative", if present, must be one of ${VALID_CLAIM_TYPES.join(', ')}` };
  }
  if (typeof r.isExtraordinary !== 'boolean') {
    return { ok: false, violation: '"isExtraordinary" must be a boolean' };
  }
  return { ok: true, value: r as ClassificationResult };
}

export async function classifyClaim(claim: string, llm: LlmClient): Promise<RemediationResult<ClassificationResult>> {
  return remediate('classify', llm, (violation) => CLASSIFY_PROMPT(claim, violation), validateClassification);
}
