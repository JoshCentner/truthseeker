// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderVerdict, renderParseError, renderRefusal, renderResult } from '../verdict-display.js';
import type { Verdict } from '../../src/index.js';

function makeVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    band: 'contested',
    qualifier: 'insufficient_evidence',
    tree: 'tree1_simple_factual',
    conditionsMet: [{ id: 'T1-CLUSTER-COUNT', protocolClause: 'FR-024: cluster count = 1' }],
    cappingConditions: [{ id: 'T1-CAP-CORROBORATION', protocolClause: 'fewer than two independent clusters' }],
    engineVersion: '0.1.0',
    schemaVersion: '0.1.0',
    dependenceMap: null,
    residue: null,
    movedBy: null,
    refusalReason: null,
    ...overrides,
  };
}

describe('verdict-display', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders band, tree, and both condition lists for a computed verdict', () => {
    renderVerdict(container, makeVerdict());
    expect(container.textContent).toContain('contested');
    expect(container.textContent).toContain('tree1_simple_factual');
    expect(container.textContent).toContain('FR-024: cluster count = 1');
    expect(container.textContent).toContain('fewer than two independent clusters');
  });

  it('SC-003: a below-ceiling band always has non-empty rendered capping conditions', () => {
    const verdict = makeVerdict({ band: 'probable', cappingConditions: [{ id: 'X', protocolClause: 'reason' }] });
    renderVerdict(container, verdict);
    const list = container.querySelector('.condition-list');
    expect(list).not.toBeNull();
    expect(container.textContent).toContain('reason');
  });

  it('renders movedBy when present', () => {
    renderVerdict(container, makeVerdict({ tree: 'aggregation', movedBy: 'sc-b' }));
    expect(container.textContent).toContain('Moved by: sc-b');
  });

  it('renders the dependence map when present', () => {
    const verdict = makeVerdict({
      dependenceMap: [{ clusterId: 'cluster-0', channels: ['data'], memberLineIds: ['o1', 'o2'] }],
    });
    renderVerdict(container, verdict);
    expect(container.textContent).toContain('cluster-0');
    expect(container.textContent).toContain('o1, o2');
  });

  it('renders a parse error visually distinct (different container class) from a verdict', () => {
    renderParseError(container, 'Unexpected token');
    expect(container.querySelector('.parse-error')).not.toBeNull();
    expect(container.querySelector('.verdict-band')).toBeNull();
  });

  it('renders a refusal visually distinct from both a parse error and a verdict', () => {
    renderRefusal(container, 'ledger input carries computed-only field(s)');
    expect(container.querySelector('.refusal')).not.toBeNull();
    expect(container.querySelector('.parse-error')).toBeNull();
    expect(container.querySelector('.verdict-band')).toBeNull();
  });

  it('renderResult dispatches on EngineResult.kind', () => {
    renderResult(container, { kind: 'parse-error', message: 'bad json' });
    expect(container.querySelector('.parse-error')).not.toBeNull();

    renderResult(container, { kind: 'refusal', reason: 'nope' });
    expect(container.querySelector('.refusal')).not.toBeNull();

    renderResult(container, { kind: 'verdict', verdict: makeVerdict() });
    expect(container.querySelector('.verdict-band')).not.toBeNull();
  });
});
