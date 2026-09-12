import type { LedgerDraft, Mode } from './types.js';
import { emptyDraft } from './types.js';

export interface LedgerEditorHandle {
  getDraft(): LedgerDraft;
  /** Populates the editor from a fixture (FR-009) or resets it on mode switch. */
  setDraft(draft: LedgerDraft): void;
}

export function mountLedgerEditor(
  container: HTMLElement,
  onRun: (draft: LedgerDraft) => void,
): LedgerEditorHandle {
  let draft: LedgerDraft = emptyDraft('evaluate');

  container.innerHTML = '';

  const modeRow = document.createElement('div');
  modeRow.className = 'mode-toggle';

  const evaluateBtn = document.createElement('button');
  evaluateBtn.textContent = 'Evaluate';
  const aggregateBtn = document.createElement('button');
  aggregateBtn.textContent = 'Aggregate';
  aggregateBtn.className = 'secondary';
  modeRow.append(evaluateBtn, aggregateBtn);

  const textarea = document.createElement('textarea');
  textarea.setAttribute('aria-label', 'Ledger JSON input');
  textarea.placeholder = 'Paste a LedgerInput (or CompoundInput in Aggregate mode) as JSON…';

  // FR-011: aggregate mode only — an optional "previous" sub-claim state, so
  // the engine can report movedBy on a recompute. Hidden entirely in
  // evaluate mode, since LedgerInput has no equivalent concept.
  const previousLabel = document.createElement('label');
  previousLabel.textContent = 'Previous sub-claims (optional, for movedBy)';
  previousLabel.className = 'previous-label';
  const previousTextarea = document.createElement('textarea');
  previousTextarea.setAttribute('aria-label', 'Previous sub-claims JSON');
  previousTextarea.placeholder = '[{ "id": "sc-a", "band": "established", "edgeType": "load_bearing" }, …]';
  previousTextarea.style.minHeight = '80px';
  const previousWrap = document.createElement('div');
  previousWrap.append(previousLabel, previousTextarea);

  const runBtn = document.createElement('button');
  runBtn.textContent = 'Run';
  runBtn.style.marginTop = '0.5rem';

  function renderModeButtons() {
    evaluateBtn.className = draft.mode === 'evaluate' ? '' : 'secondary';
    aggregateBtn.className = draft.mode === 'aggregate' ? '' : 'secondary';
    previousWrap.style.display = draft.mode === 'aggregate' ? 'block' : 'none';
  }

  // FR-010: switching modes resets the draft (data-model.md's State flow) —
  // the two input shapes are structurally different, so silently carrying
  // rawText across the switch would just produce a confusing refusal.
  function switchMode(mode: Mode) {
    if (mode === draft.mode) return;
    draft = emptyDraft(mode);
    textarea.value = '';
    previousTextarea.value = '';
    renderModeButtons();
  }

  evaluateBtn.addEventListener('click', () => switchMode('evaluate'));
  aggregateBtn.addEventListener('click', () => switchMode('aggregate'));

  // FR-002: rawText updates on every keystroke, but the engine is never
  // called until the explicit Run action.
  textarea.addEventListener('input', () => {
    draft = { ...draft, rawText: textarea.value };
  });

  // The previous-sub-claims field is parsed only at Run time (same
  // explicit-action principle as FR-002), not on every keystroke — an
  // incomplete paste here should never silently reset previousSubClaims to
  // null mid-edit.
  runBtn.addEventListener('click', () => {
    if (draft.mode === 'aggregate' && previousTextarea.value.trim().length > 0) {
      try {
        const parsed = JSON.parse(previousTextarea.value);
        draft = { ...draft, previousSubClaims: parsed };
      } catch {
        // Left as-is (previousSubClaims unchanged) — the main Run error
        // surface (FR-006/FR-007) covers the primary input; a malformed
        // optional field degrades to "no previous state", not a hard error.
      }
    }
    onRun(draft);
  });

  renderModeButtons();
  container.append(modeRow, textarea, previousWrap, runBtn);

  return {
    getDraft: () => draft,
    setDraft: (next) => {
      draft = next;
      textarea.value = next.rawText;
      previousTextarea.value = next.previousSubClaims ? JSON.stringify(next.previousSubClaims, null, 2) : '';
      renderModeButtons();
    },
  };
}
