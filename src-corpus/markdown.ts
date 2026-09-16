import { el, escapeText, link, join, empty, type Html } from './html.js';

/**
 * A restricted Markdown subset, built entirely on html.ts's constructors.
 *
 * Supported: ATX headings (levels 2–4), paragraphs, emphasis, strong emphasis,
 * ordered and unordered lists, inline code, fenced code blocks, block quotes,
 * inline links.
 *
 * Raw HTML is STRIPPED (FR-027a). Everything else outside the subset — tables,
 * images, footnotes, reference links, autolinks — renders as literal text, so a
 * contributor sees immediately that their construct did not take effect rather
 * than finding their content silently missing.
 *
 * Because every node is emitted through html.ts, this renderer cannot produce a
 * tag html.ts does not know how to construct. There is no sanitising pass and
 * no need for one: markup cannot get in, so it never has to be taken out.
 */

const HEADING = /^(#{2,4})\s+(.*)$/;
const UNORDERED = /^\s*[-*]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const FENCE = /^```/;

/** FR-027a: raw HTML is removed before anything else looks at the text. */
function stripRawHtml(line: string): string {
  return line.replace(/<\/?[A-Za-z][^>]*>/g, '');
}

/**
 * Inline constructs. Everything is escaped as it is emitted; the only tags
 * produced are <code>, <strong>, <em> and <a>, each built by html.ts.
 */
function renderInline(source: string): Html {
  const parts: Html[] = [];
  let rest = source;

  // Ordered so that code spans win: text inside backticks is never treated as
  // emphasis or as a link, matching every Markdown implementation and, more
  // importantly, meaning a quoted snippet renders as written.
  const pattern = /(`[^`]+`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(_([^_]+)_)/;

  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (!match || match.index === undefined) {
      parts.push(escapeText(rest));
      break;
    }
    if (match.index > 0) parts.push(escapeText(rest.slice(0, match.index)));

    if (match[1]) {
      parts.push(el('code', {}, escapeText(match[1].slice(1, -1))));
    } else if (match[2]) {
      // link() itself refuses any scheme but http(s), rendering inert text
      // instead (FR-027c) — this call site cannot opt out of that.
      parts.push(link(match[4] as string, match[3] as string));
    } else if (match[5]) {
      parts.push(el('strong', {}, escapeText(match[6] as string)));
    } else if (match[7]) {
      parts.push(el('em', {}, escapeText(match[8] as string)));
    } else if (match[9]) {
      parts.push(el('em', {}, escapeText(match[10] as string)));
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return join(parts);
}

export function renderMarkdown(source: string): Html {
  const lines = source.replace(/\r\n/g, '\n').split('\n').map(stripRawHtml);
  const blocks: Html[] = [];
  let i = 0;

  const flushParagraph = (buffer: string[]): void => {
    if (buffer.length === 0) return;
    blocks.push(el('p', {}, renderInline(buffer.join(' ').trim())));
    buffer.length = 0;
  };

  const paragraph: string[] = [];

  while (i < lines.length) {
    const line = lines[i] as string;

    if (line.trim() === '') {
      flushParagraph(paragraph);
      i++;
      continue;
    }

    if (FENCE.test(line)) {
      flushParagraph(paragraph);
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i] as string)) {
        code.push(lines[i] as string);
        i++;
      }
      i++; // closing fence
      blocks.push(el('pre', {}, el('code', {}, escapeText(code.join('\n')))));
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flushParagraph(paragraph);
      // Levels shift by one: the page's own <h1> is the claim, so an authored
      // "##" becomes an <h3> and cannot compete with the page structure.
      const level = Math.min(6, (heading[1] as string).length + 1);
      blocks.push(el(`h${level}`, { class: 'authored-heading' }, renderInline(heading[2] as string)));
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      flushParagraph(paragraph);
      const quoted: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i] as string)) {
        quoted.push((QUOTE.exec(lines[i] as string) as RegExpExecArray)[1] as string);
        i++;
      }
      blocks.push(el('blockquote', {}, el('p', {}, renderInline(quoted.join(' ')))));
      continue;
    }

    if (UNORDERED.test(line) || ORDERED.test(line)) {
      flushParagraph(paragraph);
      const ordered = ORDERED.test(line) && !UNORDERED.test(line);
      const items: Html[] = [];
      while (i < lines.length) {
        const current = lines[i] as string;
        const m = ordered ? ORDERED.exec(current) : UNORDERED.exec(current);
        if (!m) break;
        items.push(el('li', {}, renderInline(m[1] as string)));
        i++;
      }
      blocks.push(el(ordered ? 'ol' : 'ul', {}, join(items)));
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }
  flushParagraph(paragraph);

  return blocks.length > 0 ? join(blocks) : empty;
}
