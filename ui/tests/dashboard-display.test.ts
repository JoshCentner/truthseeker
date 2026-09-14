// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderDashboard } from '../dashboard-display.js';
import type { PipelineResult } from '../../src-pipeline/index.js';

function completedResult(): Extract<PipelineResult, { kind: 'completed' }> {
  return {
    kind: 'completed',
    ledger: {
      schemaVersion: '0.1.0',
      claimRestatement: 'test',
      classification: { primary: 'simple_factual', confidence: 'high' },
      screens: { falsifiability: 'pass', priorPlausibility: 'ordinary' },
      origins: [{ id: 'https://real.example.com/article', retrievalStatus: 'retrieved', retracted: false, correctedFormOfId: null }],
      warrants: [
        {
          originId: 'https://real.example.com/article',
          startingGrade: 'contemporaneous_record',
          firedTriggers: [],
          interestedParty: false,
          partyControlledCreationAfterStakesVisible: false,
          sourceReliabilityGrade: 'reliable',
          channelKeys: { data: null, method: null, institution: null, motive: null },
        },
      ],
      rivals: [],
      diagnosticityEntries: [{ lineOriginId: 'https://real.example.com/article', against: 'claim', mark: 'consistent' }],
      adversarialStatus: 'untested',
      silenceFinding: 'none',
      steelman: { performed: false, revisionOccurred: false },
      extraordinaryClusterSurvivedAdversarialTesting: null,
      treeExtension: null,
    },
    trace: {
      runId: 'r1',
      requester: null,
      modelIds: ['mock-model'],
      startedAt: '',
      completedAt: '',
      steps: [],
      remediationAttempts: [],
    },
  };
}

describe('dashboard-display', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders the running phase with the current step', () => {
    renderDashboard(container, { phase: 'running', currentStep: 'grade' });
    expect(container.querySelector('.phase-running')).not.toBeNull();
  });

  it('renders a connection error distinctly', () => {
    renderDashboard(container, { phase: 'connection-error', message: 'network dropped' });
    expect(container.querySelector('.connection-error')).not.toBeNull();
    expect(container.querySelector('.phase-running')).toBeNull();
  });

  it('renders rejected with the specific rule', () => {
    renderDashboard(container, { phase: 'done', result: { kind: 'rejected', rule: 'names a private individual' } });
    expect(container.querySelector('.outcome-rejected')).not.toBeNull();
    expect(container.textContent).toContain('names a private individual');
  });

  it('renders needs_review distinctly from rejected', () => {
    renderDashboard(container, { phase: 'done', result: { kind: 'needs_review', reason: 'uncertain', queuedAt: '' } });
    expect(container.querySelector('.outcome-needs-review')).not.toBeNull();
    expect(container.querySelector('.outcome-rejected')).toBeNull();
  });

  it('renders needs_clarification with its questions, distinctly from needs_review', () => {
    renderDashboard(container, { phase: 'done', result: { kind: 'needs_clarification', step: 'grade', questions: ['missing mechanism'] } });
    expect(container.querySelector('.outcome-needs-clarification')).not.toBeNull();
    expect(container.querySelector('.outcome-needs-review')).toBeNull();
    expect(container.textContent).toContain('missing mechanism');
  });

  it('renders auth_failed distinctly', () => {
    renderDashboard(container, { phase: 'done', result: { kind: 'auth_failed', message: 'invalid key' } });
    expect(container.querySelector('.outcome-auth-failed')).not.toBeNull();
  });

  it('renders a completed verdict as structured content, never raw JSON text', () => {
    renderDashboard(container, { phase: 'done', result: completedResult() });
    expect(container.querySelector('.outcome-completed')).not.toBeNull();
    expect(container.querySelector('.band')?.textContent).toBe('contested');
    expect(container.textContent).not.toContain('"schemaVersion"');
  });

  it("shows each origin's grade and diagnosticity mark together (US4)", () => {
    renderDashboard(container, { phase: 'done', result: completedResult() });
    const item = container.querySelector('.evidence-item');
    expect(item).not.toBeNull();
    expect(item?.textContent).toContain('contemporaneous_record');
    expect(item?.textContent).toContain('consistent');
    expect(item?.className).toContain('mark-consistent');
  });

  it("renders each origin's URL as a real, clickable link (FR-007)", () => {
    renderDashboard(container, { phase: 'done', result: completedResult() });
    const link = container.querySelector<HTMLAnchorElement>('.evidence-url');
    expect(link).not.toBeNull();
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toBe('https://real.example.com/article');
    expect(link?.target).toBe('_blank');
  });

  it('renders capping conditions as plain-language sentences, not the raw protocol-clause string alone (FR-007)', () => {
    renderDashboard(container, { phase: 'done', result: completedResult() });
    // This fixture has only one origin (clusterCount=1), so 001's engine
    // itself produces a real capping condition citing the corroboration
    // minimum — verifying against that real, engine-computed condition
    // rather than a hand-authored one.
    expect(container.textContent).toContain('To reach a higher band:');
  });
});
