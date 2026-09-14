import type { DashboardState } from './dashboard-types.js';
import type { PipelineResult } from '../src-pipeline/index.js';
import { evaluate } from '../src/index.js';

function el(tag: string, className?: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

const STEP_LABELS: Record<string, string> = {
  'harm-gate': 'Checking claim is in scope',
  classify: 'Classifying claim type',
  search: 'Searching for sources',
  retrieve: 'Retrieving source content',
  grade: 'Grading source evidence',
  rivals: 'Considering alternative explanations',
  diagnosticity: 'Comparing evidence to the claim',
  adversarial: 'Stress-testing the strongest evidence',
  'assemble-ledger': 'Assembling the result',
};

/** FR-005, FR-006: shows the current step; a retry within the same step is
 * still shown as that step in progress, never a new error state, since this
 * simply re-renders the same phase with the same (or repeated) step name. */
function renderRunning(container: HTMLElement, currentStep: string): void {
  container.innerHTML = '';
  const box = el('div', 'phase-running');
  box.append(el('div', 'spinner'));
  box.append(el('p', 'step-label', STEP_LABELS[currentStep] ?? currentStep));
  container.append(box);
}

function renderConnectionError(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const box = el('div', 'connection-error');
  box.append(el('strong', undefined, 'Connection lost'));
  box.append(el('p', undefined, message));
  box.append(el('p', undefined, 'The run may have been stopped — please try submitting again.'));
  container.append(box);
}

function renderRejected(container: HTMLElement, rule: string): void {
  const box = el('div', 'outcome-rejected');
  box.append(el('strong', undefined, 'This claim is out of scope'));
  box.append(el('p', undefined, rule));
  container.append(box);
}

function renderNeedsReview(container: HTMLElement, reason: string): void {
  const box = el('div', 'outcome-needs-review');
  box.append(el('strong', undefined, 'Pending human review'));
  box.append(el('p', undefined, reason));
  container.append(box);
}

function renderNeedsClarification(container: HTMLElement, step: string, questions: string[]): void {
  const box = el('div', 'outcome-needs-clarification');
  box.append(el('strong', undefined, `Could not complete the "${STEP_LABELS[step] ?? step}" step`));
  const list = document.createElement('ul');
  for (const q of questions) {
    list.append(el('li', undefined, q));
  }
  box.append(list);
  box.append(el('p', undefined, 'Try resubmitting with the missing information included in your claim.'));
  container.append(box);
}

function renderAuthFailed(container: HTMLElement, message: string): void {
  const box = el('div', 'outcome-auth-failed');
  box.append(el('strong', undefined, 'API key problem'));
  box.append(el('p', undefined, message));
  container.append(box);
}

/** Translates a capping condition's protocol-clause string into a
 * reader-facing sentence (FR-007). Kept intentionally simple for this
 * version: prefixes with a consistent, plain-language frame rather than
 * showing the raw clause text alone. */
function plainLanguageCapping(protocolClause: string): string {
  return `To reach a higher band: ${protocolClause}`;
}

function renderCompleted(container: HTMLElement, result: Extract<PipelineResult, { kind: 'completed' }>): void {
  const { ledger, trace } = result;
  const verdict = evaluate(ledger);

  const box = el('div', 'outcome-completed');
  box.append(el('p', `band band-${verdict.band ?? 'none'}`, verdict.band ?? '(no band)'));
  if (verdict.qualifier) {
    box.append(el('p', undefined, `Qualifier: ${verdict.qualifier}`));
  }

  if (verdict.cappingConditions.length > 0) {
    const capWrap = document.createElement('div');
    capWrap.append(el('strong', undefined, 'Why not higher'));
    const capList = document.createElement('ul');
    for (const c of verdict.cappingConditions) {
      capList.append(el('li', undefined, plainLanguageCapping(c.protocolClause)));
    }
    capWrap.append(capList);
    box.append(capWrap);
  }

  // FR-007 (US4): every origin's URL, grade, and diagnosticity mark shown together.
  const evidenceWrap = document.createElement('div');
  evidenceWrap.append(el('strong', undefined, 'Evidence'));
  const evidenceList = document.createElement('ul');
  evidenceList.className = 'evidence-list';
  ledger.origins.forEach((origin, i) => {
    const warrant = ledger.warrants[i];
    const diag = ledger.diagnosticityEntries.find((d) => d.lineOriginId === origin.id && d.against === 'claim');
    const item = document.createElement('li');
    item.className = `evidence-item mark-${diag?.mark ?? 'not_applicable'}`;
    // FR-007: origin.id is the source's real URL (src-pipeline/retrieve.ts) —
    // rendered as an actual link, not just text, now that there's a real URL to link to.
    const link = document.createElement('a');
    link.className = 'evidence-url';
    link.href = origin.id;
    link.textContent = origin.id;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    item.append(link);
    if (warrant) {
      item.append(el('span', 'evidence-grade', warrant.startingGrade));
    }
    item.append(el('span', 'evidence-mark', diag?.mark ?? 'not_applicable'));
    evidenceList.append(item);
  });
  evidenceWrap.append(evidenceList);
  box.append(evidenceWrap);

  box.append(el('p', 'version-stamp', `engine ${verdict.engineVersion} · model(s) ${trace.modelIds.join(', ')}`));
  container.append(box);
}

export function renderDashboard(container: HTMLElement, state: DashboardState): void {
  if (state.phase === 'idle') {
    container.innerHTML = '';
    return;
  }
  if (state.phase === 'running') {
    renderRunning(container, state.currentStep);
    return;
  }
  if (state.phase === 'connection-error') {
    renderConnectionError(container, state.message);
    return;
  }

  container.innerHTML = '';
  const result = state.result;
  if (result.kind === 'rejected') return renderRejected(container, result.rule);
  if (result.kind === 'needs_review') return renderNeedsReview(container, result.reason);
  if (result.kind === 'needs_clarification') return renderNeedsClarification(container, result.step, result.questions);
  if (result.kind === 'auth_failed') return renderAuthFailed(container, result.message);
  return renderCompleted(container, result);
}
