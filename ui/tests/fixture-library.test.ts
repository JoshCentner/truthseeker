// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { mountFixtureLibrary, draftFromEntry } from '../fixture-library.js';

describe('fixture-library', () => {
  it('discovers exactly the same set of fixture files the engine suite runs (FR-008)', () => {
    const casesDir = path.join(process.cwd(), 'tests/fixtures/cases');
    const realFileCount = readdirSync(casesDir).filter((f) => f.endsWith('.ts')).length;

    const container = document.createElement('div');
    mountFixtureLibrary(container, () => {});

    const heading = container.querySelector('h2')?.textContent ?? '';
    expect(heading).toBe(`Fixture library (${realFileCount})`);
    expect(container.querySelectorAll('.fixture-list li').length).toBe(realFileCount);
  });

  it('selecting an entry produces a draft whose rawText parses back to that fixture\'s exact input (FR-009)', () => {
    const container = document.createElement('div');
    let selectedDraft: ReturnType<typeof draftFromEntry> | null = null;
    mountFixtureLibrary(container, (draft) => {
      selectedDraft = draft;
    });

    const establishedBtn = Array.from(container.querySelectorAll('.fixture-id')).find(
      (span) => span.textContent === 'tree1-established',
    )?.closest('button');
    expect(establishedBtn, 'expected the tree1-established fixture to be in the list').toBeTruthy();
    (establishedBtn as HTMLButtonElement).click();

    expect(selectedDraft).not.toBeNull();
    expect(selectedDraft!.mode).toBe('evaluate');
    const parsedBack = JSON.parse(selectedDraft!.rawText);
    expect(parsedBack.classification.primary).toBe('simple_factual');
    expect(parsedBack.origins).toHaveLength(2);
  });

  it('never mutates the underlying fixture module on selection', () => {
    const container = document.createElement('div');
    let draft1: ReturnType<typeof draftFromEntry> | null = null;
    mountFixtureLibrary(container, (d) => {
      draft1 = d;
    });
    const btn = container.querySelector('.fixture-list li button') as HTMLButtonElement;
    btn.click();
    expect(draft1).not.toBeNull();
    // Mutate the returned draft's rawText directly — this must not be the
    // same string reference backing the fixture's own `input` object.
    draft1!.rawText = 'tampered';
    const container2 = document.createElement('div');
    let draft2: ReturnType<typeof draftFromEntry> | null = null;
    mountFixtureLibrary(container2, (d) => {
      draft2 = d;
    });
    const btn2 = container2.querySelector('.fixture-list li button') as HTMLButtonElement;
    btn2.click();
    expect(draft2!.rawText).not.toBe('tampered');
  });
});
