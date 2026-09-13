import { describe, it, expect } from 'vitest';
import { MockLlmClient } from '../llm-client.js';
import { gradeOrigin, detectRetractionOrCorrection, DEFAULT_GRADING_RUBRIC } from '../grade.js';
import type { RetrievedOrigin } from '../types.js';
import { unwrapOk } from './test-helpers.js';

function retrieved(content: string | null): RetrievedOrigin {
  return {
    id: 'o1',
    candidate: { url: 'https://example.com/x', title: '', foundVia: 'test' },
    fetch: {
      requestedUrl: 'https://example.com/x',
      finalUrl: 'https://example.com/x',
      succeeded: content !== null,
      httpStatus: content !== null ? 200 : null,
      contentHash: null,
      fetchedAt: new Date().toISOString(),
    },
    content,
    registryClass: null,
  };
}

function rawResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    startingGrade: 'contemporaneous_record',
    firedTriggers: [],
    interestedParty: false,
    partyControlledCreationAfterStakesVisible: false,
    sourceReliabilityGrade: 'Unknown',
    reasoning: 'test',
    ...overrides,
  });
}

describe('grade (FR-020-025, SC-006)', () => {
  it('never sends a claim string to the LLM — the prompt is only the rubric plus origin content', async () => {
    const llm = new MockLlmClient([{ generate: { text: rawResponse() } }]);
    await gradeOrigin(retrieved('some article content'), llm);
    expect(llm.receivedPrompts.length).toBe(1);
    expect(llm.receivedPrompts[0]).not.toContain('CLAIM_MARKER_STRING_THAT_WOULD_LEAK');
  });

  it('remediates (never silently drops) a fired trigger with no named mechanism (FR-021, FR-045)', async () => {
    const llm = new MockLlmClient([
      {
        generate: {
          text: rawResponse({
            firedTriggers: [
              { direction: 'downgrade', mechanism: 'no comparison group, so a placebo effect could produce the same result even if false' },
              { direction: 'downgrade' }, // missing mechanism — should trigger remediation, not a silent drop
            ],
          }),
        },
      },
      {
        generate: {
          text: rawResponse({
            firedTriggers: [
              { direction: 'downgrade', mechanism: 'no comparison group, so a placebo effect could produce the same result even if false' },
              { direction: 'downgrade', mechanism: 'sample selection method unstated, so cherry-picking could produce the same result even if false' },
            ],
          }),
        },
      },
    ]);
    const result = unwrapOk(await gradeOrigin(retrieved('content'), llm));
    expect(result.firedTriggers.length).toBe(2);
    expect(result.firedTriggers.every((t) => t.mechanism.length > 0)).toBe(true);
    // The retry prompt must quote back the specific missing-mechanism violation.
    expect(llm.receivedPrompts[1]).toContain('missing its required "mechanism"');
  });

  it('grades content:null as bare assertion without any LLM call (FR-022)', async () => {
    const llm = new MockLlmClient([]);
    const result = unwrapOk(await gradeOrigin(retrieved(null), llm));
    expect(result.startingGrade).toBe('assertion');
    expect(llm.receivedPrompts.length).toBe(0);
  });

  it("maps the protocol's 5-tier hierarchy onto 001's 4-tier WarrantGrade (FR-024)", async () => {
    const llmReTestable = new MockLlmClient([{ generate: { text: rawResponse({ startingGrade: 're_testable' }) } }]);
    const r1 = unwrapOk(await gradeOrigin(retrieved('content'), llmReTestable));
    expect(r1.startingGrade).toBe('physical_documentary');

    const llmPhysical = new MockLlmClient([{ generate: { text: rawResponse({ startingGrade: 'physical_documentary' }) } }]);
    const r2 = unwrapOk(await gradeOrigin(retrieved('content'), llmPhysical));
    expect(r2.startingGrade).toBe('physical_documentary');
  });

  it("maps the protocol's reliability vocabulary onto 001's enum values", async () => {
    const cases: [string, string][] = [
      ['Strong', 'reliable'],
      ['Mixed', 'mixed'],
      ['Unknown', 'not_rated'],
      ['Poor', 'poor'],
      ['Fabricator', 'fabricator'],
    ];
    for (const [proto, engine] of cases) {
      const llm = new MockLlmClient([{ generate: { text: rawResponse({ sourceReliabilityGrade: proto }) } }]);
      const result = unwrapOk(await gradeOrigin(retrieved('content'), llm));
      expect(result.sourceReliabilityGrade).toBe(engine);
    }
  });

  it('an invalid startingGrade enum value triggers remediation rather than silently passing through', async () => {
    const llm = new MockLlmClient([
      { generate: { text: rawResponse({ startingGrade: 'super_duper_reliable' }) } },
      { generate: { text: rawResponse({ startingGrade: 'testimony' }) } },
    ]);
    const result = unwrapOk(await gradeOrigin(retrieved('content'), llm));
    expect(result.startingGrade).toBe('testimony');
    expect(llm.receivedPrompts[1]).toContain('startingGrade');
  });

  it('rubric text is non-empty and mentions the D1-D4 triggers verbatim', () => {
    expect(DEFAULT_GRADING_RUBRIC.text).toContain('D1 Methodological weakness');
    expect(DEFAULT_GRADING_RUBRIC.text).toContain('D4 Internal inconsistency');
  });
});

describe('detectRetractionOrCorrection (FR-023)', () => {
  it('detects an explicit retraction notice', () => {
    expect(detectRetractionOrCorrection('This article has been retracted due to errors.').retracted).toBe(true);
  });

  it('detects a correction note distinct from a retraction', () => {
    const result = detectRetractionOrCorrection("Editor's note: this piece was corrected on Jan 5.");
    expect(result.retracted).toBe(false);
    expect(result.noted).toBe(true);
  });

  it('flags neither for ordinary content', () => {
    const result = detectRetractionOrCorrection('This is a completely ordinary news article.');
    expect(result.retracted).toBe(false);
    expect(result.noted).toBe(false);
  });
});
