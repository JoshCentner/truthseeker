import type { LlmClient } from './llm-client.js';
import type { ClaimType } from '../src/index.js';

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
const CLASSIFY_PROMPT = (claim: string): string => `Classify this claim per AGENT-PROTOCOL-v3.md Step 1:

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

export async function classifyClaim(claim: string, llm: LlmClient): Promise<ClassificationResult> {
  const response = await llm.generate(CLASSIFY_PROMPT(claim));
  const cleaned = response.text.trim().replace(/^```(?:json)?\n?/, '').replace(/```$/, '');
  const raw: ClassificationResult = JSON.parse(cleaned);
  return {
    primary: raw.primary,
    confidence: raw.confidence,
    alternative: raw.alternative,
    isExtraordinary: raw.isExtraordinary,
  };
}
