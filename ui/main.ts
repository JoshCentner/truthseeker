import { run } from './engine-bridge.js';
import { renderResult } from './verdict-display.js';
import { mountLedgerEditor } from './ledger-editor.js';
import { mountFixtureLibrary } from './fixture-library.js';
import { mountCopyButton } from './clipboard.js';
import type { Verdict } from '../src/index.js';

const editorContainer = document.getElementById('ledger-editor')!;
const resultsContainer = document.getElementById('verdict-display')!;
const fixtureContainer = document.getElementById('fixture-library')!;

const copyButtonContainer = document.createElement('div');
resultsContainer.after(copyButtonContainer);

let lastVerdict: Verdict | null = null;

const editor = mountLedgerEditor(editorContainer, (draft) => {
  const result = run(draft);
  lastVerdict = result.kind === 'verdict' ? result.verdict : null;
  renderResult(resultsContainer, result);
  copyButtonContainer.innerHTML = '';
  if (lastVerdict) {
    mountCopyButton(copyButtonContainer, () => lastVerdict);
  }
});

// FR-009: selecting a fixture populates the editor; it does not auto-run —
// running still requires the explicit Run action (FR-002).
mountFixtureLibrary(fixtureContainer, (draft) => {
  editor.setDraft(draft);
});
