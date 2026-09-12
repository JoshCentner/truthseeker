import { describe, it, expect } from 'vitest';
import { run } from '../engine-bridge.js';
import { emptyDraft } from '../types.js';

describe('engine-bridge run()', () => {
  it('returns parse-error for invalid JSON, without calling the engine', () => {
    const draft = { ...emptyDraft('evaluate'), rawText: '{ this is not json' };
    const result = run(draft);
    expect(result.kind).toBe('parse-error');
  });

  it('returns refusal for schema-invalid JSON', () => {
    const draft = { ...emptyDraft('evaluate'), rawText: JSON.stringify({ schemaVersion: '0.1.0' }) };
    const result = run(draft);
    expect(result.kind).toBe('refusal');
    if (result.kind === 'refusal') {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('returns a verdict for a valid ledger', () => {
    const ledger = {
      schemaVersion: '0.1.0',
      claimRestatement: 'Test claim',
      classification: { primary: 'simple_factual', confidence: 'high' },
      screens: { falsifiability: 'pass', priorPlausibility: 'ordinary' },
      origins: [{ id: 'o1', retrievalStatus: 'retrieved', retracted: false, correctedFormOfId: null }],
      warrants: [
        {
          originId: 'o1',
          startingGrade: 'contemporaneous_record',
          firedTriggers: [],
          interestedParty: false,
          partyControlledCreationAfterStakesVisible: false,
          sourceReliabilityGrade: 'reliable',
          channelKeys: { data: null, method: null, institution: null, motive: null },
        },
      ],
      rivals: [],
      diagnosticityEntries: [{ lineOriginId: 'o1', against: 'claim', mark: 'consistent' }],
      adversarialStatus: 'untested',
      silenceFinding: 'none',
      steelman: { performed: false, revisionOccurred: false },
      extraordinaryClusterSurvivedAdversarialTesting: null,
      treeExtension: null,
    };
    const draft = { ...emptyDraft('evaluate'), rawText: JSON.stringify(ledger) };
    const result = run(draft);
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') {
      expect(result.verdict.band).toBe('contested'); // single cluster only, below corroboration minimum
      expect(result.verdict.tree).toBe('tree1_simple_factual');
    }
  });

  it('returns refusal for a cyclic compound input', () => {
    const compound = {
      subClaims: [
        { id: 'a', band: 'probable', edgeType: 'load_bearing' },
        { id: 'b', band: 'probable', edgeType: 'load_bearing' },
      ],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };
    const draft = { ...emptyDraft('aggregate'), rawText: JSON.stringify(compound) };
    const result = run(draft);
    expect(result.kind).toBe('refusal');
  });

  it('reports movedBy when a previous sub-claim state is supplied', () => {
    const compound = {
      subClaims: [
        { id: 'sc-a', band: 'established', edgeType: 'load_bearing' },
        { id: 'sc-b', band: 'contested', edgeType: 'load_bearing' },
      ],
      edges: [],
    };
    const draft = {
      mode: 'aggregate' as const,
      rawText: JSON.stringify(compound),
      previousSubClaims: [
        { id: 'sc-a', band: 'established' as const, edgeType: 'load_bearing' as const },
        { id: 'sc-b', band: 'established' as const, edgeType: 'load_bearing' as const },
      ],
    };
    const result = run(draft);
    expect(result.kind).toBe('verdict');
    if (result.kind === 'verdict') {
      expect(result.verdict.movedBy).toBe('sc-b');
    }
  });
});
