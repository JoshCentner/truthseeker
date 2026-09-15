import { describe, it, expect } from 'vitest';
import { evaluate } from '../../src/index.js';
import { assembleLedger, type AssembleLedgerInput } from '../assemble-ledger.js';
import type { RetrievedOrigin } from '../types.js';

function retrievedOrigin(id: string, content: string | null): RetrievedOrigin {
  return {
    id,
    candidate: { url: `https://example.com/${id}`, title: '', foundVia: 'test' },
    fetch: {
      requestedUrl: `https://example.com/${id}`,
      finalUrl: `https://example.com/${id}`,
      succeeded: content !== null,
      httpStatus: content !== null ? 200 : null,
      contentHash: null,
      fetchedAt: new Date().toISOString(),
    },
    content,
    registryClass: null,
  };
}

describe('assembleLedger (FR-033, SC-004)', () => {
  it("produces a LedgerInput that 001's real evaluate() accepts with no refusalReason", () => {
    const origins = [retrievedOrigin('o1', 'content one'), retrievedOrigin('o2', 'content two')];
    const input: AssembleLedgerInput = {
      claim: 'Test claim for pipeline assembly',
      classification: { primary: 'simple_factual', confidence: 'high', isExtraordinary: false },
      origins,
      grades: [
        {
          startingGrade: 'contemporaneous_record',
          firedTriggers: [],
          interestedParty: false,
          partyControlledCreationAfterStakesVisible: false,
          sourceReliabilityGrade: 'reliable',
          rawModelReasoning: '',
        },
        {
          startingGrade: 'contemporaneous_record',
          firedTriggers: [],
          interestedParty: false,
          partyControlledCreationAfterStakesVisible: false,
          sourceReliabilityGrade: 'reliable',
          rawModelReasoning: '',
        },
      ],
      diagnostics: [
        { markAgainstClaim: 'consistent', marksAgainstRivals: {} },
        { markAgainstClaim: 'consistent', marksAgainstRivals: {} },
      ],
      rivals: [],
      adversarialStatus: 'survived',
      steelmanPerformed: true,
      steelmanRevisionOccurred: false,
      extraordinaryClusterSurvivedAdversarialTesting: null,
    };

    const ledger = assembleLedger(input);
    const verdict = evaluate(ledger);

    expect(verdict.refusalReason, `unexpected refusal: ${verdict.refusalReason}`).toBeNull();
    expect(verdict.band).toBe('established');
    expect(verdict.tree).toBe('tree1_simple_factual');
  });

  it('produces an accepted ledger for a claim with zero surviving origins', () => {
    const input: AssembleLedgerInput = {
      claim: 'A claim with no discoverable sources',
      classification: { primary: 'simple_factual', confidence: 'high', isExtraordinary: false },
      origins: [],
      grades: [],
      diagnostics: [],
      rivals: [],
      adversarialStatus: 'untested',
      steelmanPerformed: false,
      steelmanRevisionOccurred: false,
      extraordinaryClusterSurvivedAdversarialTesting: null,
    };
    const ledger = assembleLedger(input);
    const verdict = evaluate(ledger);
    expect(verdict.refusalReason).toBeNull();
    expect(verdict.band).toBe('unsupported');
  });

  it('produces an accepted ledger for a could-not-retrieve origin', () => {
    const origins = [retrievedOrigin('o1', null)];
    const input: AssembleLedgerInput = {
      claim: 'A claim whose only source could not be retrieved',
      classification: { primary: 'simple_factual', confidence: 'high', isExtraordinary: false },
      origins,
      grades: [
        {
          startingGrade: 'assertion',
          firedTriggers: [],
          interestedParty: false,
          partyControlledCreationAfterStakesVisible: false,
          sourceReliabilityGrade: 'not_rated',
          rawModelReasoning: '',
        },
      ],
      diagnostics: [{ markAgainstClaim: 'not_applicable', marksAgainstRivals: {} }],
      rivals: [],
      adversarialStatus: 'untested',
      steelmanPerformed: false,
      steelmanRevisionOccurred: false,
      extraordinaryClusterSurvivedAdversarialTesting: null,
    };
    const ledger = assembleLedger(input);
    expect(ledger.origins[0]!.retrievalStatus).toBe('could_not_retrieve');
    const verdict = evaluate(ledger);
    expect(verdict.refusalReason).toBeNull();
  });

  // Regression coverage for a real bug: buildTreeExtension originally fell
  // through to `null` for causal/predictive/complex_system, and Trees 2-4 all
  // require a matching treeExtension — a null one makes evaluate() refuse
  // rather than compute a band. Each of these three MUST produce a conservative
  // placeholder that evaluate() accepts, never a refusal.
  for (const primary of ['causal', 'predictive', 'complex_system'] as const) {
    it(`produces an accepted (non-refused) ledger for a '${primary}' claim with no origins`, () => {
      const input: AssembleLedgerInput = {
        claim: `A ${primary} claim with no sources found`,
        classification: { primary, confidence: 'high', isExtraordinary: false },
        origins: [],
        grades: [],
        diagnostics: [],
        rivals: [],
        adversarialStatus: 'untested',
        steelmanPerformed: false,
        steelmanRevisionOccurred: false,
        extraordinaryClusterSurvivedAdversarialTesting: null,
      };
      const ledger = assembleLedger(input);
      expect(ledger.treeExtension, `${primary} MUST have a non-null treeExtension`).not.toBeNull();
      const verdict = evaluate(ledger);
      expect(verdict.refusalReason, `${primary}: unexpected refusal: ${verdict.refusalReason}`).toBeNull();
      expect(verdict.band).not.toBeNull();
    });
  }
});
