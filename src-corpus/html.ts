/**
 * The boundary. Every string that reaches a generated page crosses through this
 * module, and every tag on a page is constructed here.
 *
 * The design is deliberate (research.md §2). The conventional approach — render
 * markup with a general-purpose library, then sanitise the result — is a
 * blocklist: it produces arbitrary HTML and then removes the parts currently
 * known to be dangerous, so its failure mode is an unrecognised construct
 * passing through silently. This module inverts that. It can only emit tags
 * whose names appear in ALLOWED_TAGS below, with attributes whose names appear
 * in ALLOWED_ATTRS, and it escapes every piece of text on the way in. To emit a
 * <script> the code would have to contain a line emitting a <script>, and there
 * is no such line.
 *
 * That single mechanism covers FR-027a (strip raw HTML), FR-027b (escape
 * run-record strings) and FR-027d (no executable content) at once, rather than
 * three overlapping mechanisms with gaps between them.
 */

/** Text already escaped and safe to concatenate into markup. */
export type Html = string & { readonly __html: unique symbol };

const asHtml = (s: string): Html => s as Html;

/** The complete set of tags a generated page may contain. */
const ALLOWED_TAGS = new Set([
  'html', 'head', 'meta', 'title', 'style', 'body',
  'header', 'main', 'section', 'article', 'footer', 'nav', 'aside',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'div', 'span', 'br', 'hr',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption',
  'a', 'em', 'strong', 'code', 'pre', 'blockquote', 'small', 'abbr',
]);

/** Attributes a generated page may carry. Note the absence of every `on*`
 * handler, `style`, `src`, and anything else that can execute or fetch. */
const ALLOWED_ATTRS = new Set(['class', 'id', 'href', 'lang', 'charset', 'name', 'content', 'title', 'colspan', 'scope']);

const VOID_TAGS = new Set(['meta', 'br', 'hr']);

/** Escapes text for a text node. */
export function escapeText(value: string): Html {
  return asHtml(
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
  );
}

/** Escapes a value destined for a double-quoted attribute. Separate from
 * escapeText because the contexts genuinely differ, and conflating them is how
 * attribute-context bugs appear. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\r\n\t]/g, ' ');
}

/**
 * FR-027c: only http and https are rendered as links. Everything else —
 * javascript:, data:, file:, vbscript:, and any scheme invented after this was
 * written — is refused. Parsing is done with the URL constructor rather than a
 * regex so that obfuscations like leading whitespace, embedded newlines or
 * mixed case resolve the same way a browser would resolve them.
 */
export function isSafeHref(raw: string): boolean {
  try {
    const parsed = new URL(raw.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false; // Relative or malformed: not linkable in a standalone file.
  }
}

export type Attrs = Record<string, string | undefined>;

/**
 * Constructs one element. Throws rather than degrading if asked for a tag or
 * attribute outside the allowlist — a silent fallback here would be the exact
 * hole this module exists to close, and it would only be noticed once something
 * dangerous had already shipped.
 */
export function el(tag: string, attrs: Attrs, ...children: Html[]): Html {
  if (!ALLOWED_TAGS.has(tag)) {
    throw new Error(`html.el: tag "${tag}" is not in the allowlist`);
  }
  const rendered = Object.entries(attrs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => {
      if (!ALLOWED_ATTRS.has(name)) {
        throw new Error(`html.el: attribute "${name}" is not in the allowlist (tag "${tag}")`);
      }
      if (name === 'href' && !isSafeHref(value)) {
        throw new Error(`html.el: refusing to emit href with unsafe scheme: ${value}`);
      }
      return ` ${name}="${escapeAttr(value)}"`;
    })
    .join('');
  if (VOID_TAGS.has(tag)) {
    return asHtml(`<${tag}${rendered}>`);
  }
  return asHtml(`<${tag}${rendered}>${children.join('')}</${tag}>`);
}

/** Joins already-escaped fragments. */
export function join(parts: Html[], separator = ''): Html {
  return asHtml(parts.join(separator));
}

/** Escapes and wraps plain text as a fragment with no element around it. */
export const text = escapeText;

/** An empty fragment. */
export const empty = asHtml('');

/**
 * Renders a link, or inert escaped text when the scheme is not http(s)
 * (FR-027c). Callers pass raw, unescaped values.
 */
export function link(href: string, label: string, attrs: Attrs = {}): Html {
  if (!isSafeHref(href)) {
    return el('span', { class: 'inert-link', title: 'Link not rendered: unsupported URL scheme' }, escapeText(label));
  }
  return el('a', { ...attrs, href }, escapeText(label));
}

/**
 * Wraps a finished body in the document shell. The page declares no external
 * resource of any kind: no font, no stylesheet, no script, no image. Opening it
 * makes zero network requests, which is both FR-027d and a privacy property —
 * a page that fetches a font tells whoever serves that font which claim is
 * being read.
 */
export function document(title: string, styleCss: string, body: Html): string {
  const head = join([
    el('meta', { charset: 'utf-8' }),
    el('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
    el('title', {}, escapeText(title)),
    // The stylesheet is authored by this project, not by any contributor or
    // fetched source, so it is the one string that is not escaped. Nothing
    // outside src-corpus/ can reach it.
    el('style', {}, asHtml(styleCss)),
  ]);
  return `<!doctype html>\n${el('html', { lang: 'en' }, el('head', {}, head), el('body', {}, body))}\n`;
}
