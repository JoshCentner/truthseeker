import type { Verdict } from '../src/index.js';
import type { EngineResult } from './types.js';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function renderConditionList(title: string, conditions: { id: string; protocolClause: string }[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.append(el('strong', undefined, `${title}${conditions.length === 0 ? ' (none)' : ''}`));
  if (conditions.length > 0) {
    const list = document.createElement('ul');
    list.className = 'condition-list';
    for (const c of conditions) {
      list.append(el('li', undefined, `[${c.id}] ${c.protocolClause}`));
    }
    wrap.append(list);
  }
  return wrap;
}

/** FR-004, FR-005, FR-014: full trace, version stamps, dependence map when present. */
export function renderVerdict(container: HTMLElement, verdict: Verdict): void {
  container.innerHTML = '';

  const band = el('p', `verdict-band band-${verdict.band ?? 'none'}`, verdict.band ?? '(no band — see conditions)');
  container.append(band);

  if (verdict.qualifier) {
    container.append(el('p', undefined, `Qualifier: ${verdict.qualifier}`));
  }
  container.append(el('p', undefined, `Tree: ${verdict.tree}`));

  container.append(renderConditionList('Conditions met', verdict.conditionsMet));
  container.append(renderConditionList('Capping conditions', verdict.cappingConditions));

  if (verdict.movedBy) {
    container.append(el('p', undefined, `Moved by: ${verdict.movedBy}`));
  }

  if (verdict.dependenceMap && verdict.dependenceMap.length > 0) {
    const depWrap = document.createElement('div');
    depWrap.append(el('strong', undefined, 'Dependence map'));
    const list = document.createElement('ul');
    list.className = 'condition-list';
    for (const d of verdict.dependenceMap) {
      list.append(
        el('li', undefined, `${d.clusterId}: [${d.memberLineIds.join(', ')}] via ${d.channels.join(', ')}`),
      );
    }
    depWrap.append(list);
    container.append(depWrap);
  }

  if (verdict.residue) {
    container.append(el('p', undefined, `Residue: ${verdict.residue}`));
  }

  container.append(
    el('p', 'version-stamp', `engine ${verdict.engineVersion} · schema ${verdict.schemaVersion}`),
  );
}

/** FR-006: visually distinct from a computed verdict — the JSON itself is broken. */
export function renderParseError(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const box = el('div', 'parse-error');
  box.append(el('strong', undefined, 'Invalid JSON'));
  box.append(el('p', undefined, message));
  container.append(box);
}

/** FR-007: visually distinct from both a parse error and a computed verdict. */
export function renderRefusal(container: HTMLElement, reason: string): void {
  container.innerHTML = '';
  const box = el('div', 'refusal');
  box.append(el('strong', undefined, 'Engine refused'));
  box.append(el('p', undefined, reason));
  container.append(box);
}

export function renderResult(container: HTMLElement, result: EngineResult): void {
  if (result.kind === 'parse-error') return renderParseError(container, result.message);
  if (result.kind === 'refusal') return renderRefusal(container, result.reason);
  return renderVerdict(container, result.verdict);
}
