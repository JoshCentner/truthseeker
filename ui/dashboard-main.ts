import { submitClaim } from './dashboard-client.js';
import { renderDashboard } from './dashboard-display.js';
import type { DashboardState } from './dashboard-types.js';

const form = document.getElementById('claim-form') as HTMLFormElement;
const claimInput = document.getElementById('claim-input') as HTMLTextAreaElement;
const keyInput = document.getElementById('key-input') as HTMLInputElement;
const resultsContainer = document.getElementById('dashboard-results')!;

let state: DashboardState = { phase: 'idle' };
function setState(next: DashboardState) {
  state = next;
  renderDashboard(resultsContainer, state);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const claim = claimInput.value.trim();
  const apiKey = keyInput.value.trim();
  // FR-004: never attempted without a key — submitClaim() itself is also
  // guarded, but the form-level check keeps the browser from even trying.
  if (!claim || !apiKey) return;
  void submitClaim(claim, apiKey, setState);
});

renderDashboard(resultsContainer, state);
