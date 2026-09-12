import type { FixtureCase } from '../tests/fixtures/helpers.js';
import type { LedgerDraft } from './types.js';

export interface FixtureLibraryEntry {
  id: string;
  protocolClause: string;
  case_: FixtureCase;
}

/**
 * Vite-resolved at build time (research.md §2) — the fixture list is always
 * exactly the real files under tests/fixtures/cases/, with no separate
 * manifest that could drift from them. The pattern is relative to this file's
 * own directory (ui/), not the repo root, since Vite's project root is set to
 * 'ui' (vite.config.ts) — corrected here from research.md's original
 * absolute-style example, which would have resolved inside ui/ instead.
 */
export function getFixtureEntries(): FixtureLibraryEntry[] {
  return loadEntries();
}

function loadEntries(): FixtureLibraryEntry[] {
  const modules = import.meta.glob<{ case_: FixtureCase }>('../tests/fixtures/cases/*.ts', { eager: true });
  return Object.values(modules).map((mod) => ({
    id: mod.case_.id,
    protocolClause: mod.case_.protocolClause,
    case_: mod.case_,
  }));
}

/** FR-009: never mutates the source fixture — always builds a fresh, independent draft. */
export function draftFromEntry(entry: FixtureLibraryEntry): LedgerDraft {
  const c = entry.case_;
  return {
    mode: c.kind === 'evaluate' ? 'evaluate' : 'aggregate',
    rawText: JSON.stringify(c.input, null, 2),
    previousSubClaims: c.kind === 'aggregate' ? (c.previous?.subClaims ?? null) : null,
  };
}

export function mountFixtureLibrary(container: HTMLElement, onSelect: (draft: LedgerDraft) => void): void {
  const entries = loadEntries().sort((a, b) => a.protocolClause.localeCompare(b.protocolClause));

  container.innerHTML = '';
  const heading = document.createElement('h2');
  heading.textContent = `Fixture library (${entries.length})`;
  container.append(heading);

  const list = document.createElement('ul');
  list.className = 'fixture-list';
  for (const entry of entries) {
    const li = document.createElement('li');
    const btn = document.createElement('button');

    const idSpan = document.createElement('span');
    idSpan.className = 'fixture-id';
    idSpan.textContent = entry.id;

    const clauseSpan = document.createElement('span');
    clauseSpan.className = 'fixture-clause';
    clauseSpan.textContent = entry.protocolClause;

    btn.append(idSpan, clauseSpan);
    btn.addEventListener('click', () => onSelect(draftFromEntry(entry)));
    li.append(btn);
    list.append(li);
  }
  container.append(list);
}
