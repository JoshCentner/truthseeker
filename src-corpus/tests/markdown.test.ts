import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../markdown.js';

describe('restricted Markdown subset (FR-027a)', () => {
  describe('supported constructs', () => {
    it('renders paragraphs', () => {
      expect(renderMarkdown('Hello there.')).toBe('<p>Hello there.</p>');
    });

    it('joins wrapped lines into one paragraph', () => {
      expect(renderMarkdown('one\ntwo')).toBe('<p>one two</p>');
    });

    it('shifts authored headings down one level so they cannot compete with the page h1', () => {
      expect(renderMarkdown('## Title')).toContain('<h3');
      expect(renderMarkdown('### Sub')).toContain('<h4');
    });

    it('renders emphasis and strong emphasis', () => {
      expect(renderMarkdown('a *b* c')).toBe('<p>a <em>b</em> c</p>');
      expect(renderMarkdown('a **b** c')).toBe('<p>a <strong>b</strong> c</p>');
      expect(renderMarkdown('a _b_ c')).toBe('<p>a <em>b</em> c</p>');
    });

    it('renders unordered and ordered lists', () => {
      expect(renderMarkdown('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
      expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
    });

    it('renders inline code and fenced code blocks', () => {
      expect(renderMarkdown('use `x`')).toBe('<p>use <code>x</code></p>');
      expect(renderMarkdown('```\nline\n```')).toBe('<pre><code>line</code></pre>');
    });

    it('renders block quotes', () => {
      expect(renderMarkdown('> quoted')).toBe('<blockquote><p>quoted</p></blockquote>');
    });

    it('renders http(s) links', () => {
      expect(renderMarkdown('[x](https://example.com)')).toBe('<p><a href="https://example.com">x</a></p>');
    });

    it('does not treat text inside a code span as markup', () => {
      expect(renderMarkdown('`**not bold**`')).toBe('<p><code>**not bold**</code></p>');
    });
  });

  describe('raw HTML is stripped, never passed through or displayed as markup', () => {
    it('strips a script tag and keeps its text as inert content', () => {
      const out = renderMarkdown('before <script>alert(1)</script> after');
      expect(out).not.toContain('<script');
      expect(out).toContain('alert(1)');
    });

    it('strips an img with an onerror handler', () => {
      const out = renderMarkdown('<img src=x onerror=alert(1)>');
      expect(out).not.toContain('<img');
      expect(out).not.toContain('onerror');
    });

    it('strips an iframe', () => {
      expect(renderMarkdown('<iframe src="https://evil.example"></iframe>')).not.toContain('<iframe');
    });

    it('strips a tag split across attributes', () => {
      const out = renderMarkdown('<a href="javascript:alert(1)">click</a>');
      expect(out).not.toContain('javascript:');
      expect(out).toContain('click');
    });
  });

  describe('unsafe links', () => {
    it('renders a javascript: link as inert text, never as an anchor', () => {
      const out = renderMarkdown('[click](javascript:alert(1))');
      expect(out).not.toContain('<a ');
      expect(out).toContain('click');
    });

    it('renders a data: link as inert text', () => {
      expect(renderMarkdown('[x](data:text/html,<script>)')).not.toContain('<a ');
    });
  });

  describe('out-of-subset constructs render as literal text, not silently dropped', () => {
    it('leaves a table as text so the contributor sees it did not work', () => {
      const out = renderMarkdown('| a | b |\n| - | - |');
      expect(out).toContain('| a | b |');
      expect(out).not.toContain('<table');
    });

    it('leaves image syntax visible rather than dropping the content', () => {
      const out = renderMarkdown('![alt](https://example.com/x.png)');
      expect(out).not.toContain('<img');
      expect(out).toContain('alt');
    });
  });

  it('escapes stray angle brackets and ampersands in ordinary prose', () => {
    expect(renderMarkdown('5 > 3 && 2 < 4')).toContain('5 &gt; 3 &amp;&amp; 2 &lt; 4');
  });

  it('produces nothing for empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown('   \n  \n')).toBe('');
  });
});
