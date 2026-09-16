import { describe, it, expect } from 'vitest';
import { escapeText, escapeAttr, isSafeHref, el, link, document } from '../html.js';

describe('html escaping boundary (FR-027b, FR-027c, FR-027d)', () => {
  it('escapes every character that could open a tag or close an attribute', () => {
    expect(escapeText('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    expect(escapeText("it's & more")).toBe('it&#39;s &amp; more');
  });

  it('escapes ampersands first, so escaped output is never double-decoded', () => {
    // If & were escaped last, "&lt;" would already be present and become "&amp;lt;"
    // only by accident of ordering. Pinning this prevents a subtle regression.
    expect(escapeText('&lt;')).toBe('&amp;lt;');
  });

  it('neutralises attribute-context breakouts including newlines', () => {
    expect(escapeAttr('" onerror="alert(1)')).toBe('&quot; onerror=&quot;alert(1)');
    expect(escapeAttr('a\nb\tc')).toBe('a b c');
  });

  describe('URL scheme gate', () => {
    it('accepts http and https', () => {
      expect(isSafeHref('https://example.com/a')).toBe(true);
      expect(isSafeHref('http://example.com')).toBe(true);
    });

    it('rejects every scheme that can execute or embed', () => {
      for (const href of [
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        '  javascript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD4=',
        'vbscript:msgbox(1)',
        'file:///etc/passwd',
      ]) {
        expect(isSafeHref(href), href).toBe(false);
      }
    });

    it('rejects relative URLs, which cannot resolve in a standalone file', () => {
      expect(isSafeHref('/claims/other.html')).toBe(false);
      expect(isSafeHref('../x')).toBe(false);
    });
  });

  describe('element construction allowlist', () => {
    it('refuses a tag outside the allowlist rather than degrading', () => {
      expect(() => el('script', {}, escapeText('x'))).toThrow(/not in the allowlist/);
      expect(() => el('iframe', {}, escapeText('x'))).toThrow(/not in the allowlist/);
      expect(() => el('object', {}, escapeText('x'))).toThrow(/not in the allowlist/);
    });

    it('refuses event-handler and resource attributes', () => {
      expect(() => el('div', { onclick: 'alert(1)' })).toThrow(/not in the allowlist/);
      expect(() => el('div', { onerror: 'alert(1)' })).toThrow(/not in the allowlist/);
      expect(() => el('div', { style: 'x' })).toThrow(/not in the allowlist/);
      expect(() => el('div', { src: 'https://example.com/x.js' })).toThrow(/not in the allowlist/);
    });

    it('refuses an unsafe href even on an allowed attribute name', () => {
      expect(() => el('a', { href: 'javascript:alert(1)' }, escapeText('x'))).toThrow(/unsafe scheme/);
    });

    it('escapes attribute values it does accept', () => {
      expect(el('div', { class: '" onerror="alert(1)' })).toBe(
        '<div class="&quot; onerror=&quot;alert(1)"></div>',
      );
    });

    it('emits void tags without a closing tag', () => {
      expect(el('meta', { charset: 'utf-8' })).toBe('<meta charset="utf-8">');
      expect(el('br', {})).toBe('<br>');
    });
  });

  describe('link()', () => {
    it('renders http(s) as a real link', () => {
      // The href is preserved exactly as authored — the scheme gate validates,
      // it does not normalise. Rewriting a contributor's URL would be a silent
      // edit to a cited source.
      expect(link('https://example.com', 'Example')).toBe('<a href="https://example.com">Example</a>');
    });

    it('renders an unsafe scheme as inert text, not a link', () => {
      const out = link('javascript:alert(1)', 'Click me');
      expect(out).not.toContain('<a ');
      expect(out).not.toContain('javascript:');
      expect(out).toContain('Click me');
    });

    it('escapes the label whichever branch is taken', () => {
      expect(link('https://example.com', '<script>')).toContain('&lt;script&gt;');
      expect(link('javascript:x', '<script>')).toContain('&lt;script&gt;');
    });
  });

  describe('document()', () => {
    it('references no external resource of any kind', () => {
      const page = document('T', 'body{color:#000}', el('p', {}, escapeText('hi')));
      expect(page).not.toMatch(/<script/i);
      expect(page).not.toMatch(/\ssrc=/i);
      expect(page).not.toMatch(/<link/i);
      expect(page).not.toMatch(/https?:\/\//);
    });

    it('escapes the title', () => {
      expect(document('<script>', 'x', el('p', {}, escapeText('hi')))).toContain('<title>&lt;script&gt;</title>');
    });
  });
});
