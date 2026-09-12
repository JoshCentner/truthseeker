import type { Verdict } from '../src/index.js';

/**
 * FR-013. Uses the Clipboard API directly rather than a copy library — one
 * browser-native call, no dependency justified for it.
 */
export async function copyVerdictToClipboard(verdict: Verdict): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(verdict, null, 2));
    return true;
  } catch {
    return false;
  }
}

export function mountCopyButton(container: HTMLElement, getVerdict: () => Verdict | null): void {
  const btn = document.createElement('button');
  btn.className = 'secondary';
  btn.textContent = 'Copy verdict as JSON';
  btn.style.marginTop = '0.5rem';
  btn.addEventListener('click', async () => {
    const verdict = getVerdict();
    if (!verdict) return;
    const ok = await copyVerdictToClipboard(verdict);
    btn.textContent = ok ? 'Copied!' : 'Copy failed';
    setTimeout(() => {
      btn.textContent = 'Copy verdict as JSON';
    }, 1500);
  });
  container.append(btn);
}
