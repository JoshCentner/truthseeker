/**
 * A deliberately restricted frontmatter parser. NOT YAML (research.md §3).
 *
 * The reason is not size, it is silent mutation. Full YAML applies implicit
 * typing: `edgeType: no` becomes the boolean false, `parentClaim: 1.20` loses a
 * digit, and a restatement beginning with digits and a colon can be read as a
 * sexagesimal number. In a file format whose entire job is stable claim
 * identity, a parser that quietly changes a value is the worst possible
 * property — FR-007's immutability rules exist precisely to stop identity
 * drifting, and a YAML coercion would drift it before validation ever saw it.
 *
 * So: three forms, every value a literal string, and an error naming the file
 * and line for anything else. The parser never guesses.
 */

export interface FrontmatterResult {
  data: Record<string, string | string[]>;
  body: string;
}

export class FrontmatterError extends Error {
  constructor(
    message: string,
    readonly file: string,
    readonly line: number,
  ) {
    super(`${file}:${line}: ${message}`);
  }
}

const DELIMITER = '---';
const KEY = /^([A-Za-z][A-Za-z0-9_]*):(.*)$/;
const LIST_ITEM = /^\s+-\s+(.*)$/;
const INDENTED = /^\s+\S/;

/**
 * Splits a file into its frontmatter block and body. A file with no leading
 * delimiter has no frontmatter, which is legitimate for supplementary files.
 */
function split(source: string, file: string): { block: string[]; body: string; offset: number } | null {
  const normalised = source.replace(/\r\n/g, '\n');
  const lines = normalised.split('\n');
  if (lines[0]?.trim() !== DELIMITER) return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === DELIMITER);
  if (end === -1) {
    throw new FrontmatterError('frontmatter opened with --- but never closed', file, 1);
  }
  return { block: lines.slice(1, end), body: lines.slice(end + 1).join('\n').trim(), offset: 2 };
}

export function parseFrontmatter(source: string, file: string): FrontmatterResult {
  const parts = split(source, file);
  if (!parts) return { data: {}, body: source.replace(/\r\n/g, '\n').trim() };

  const data: Record<string, string | string[]> = {};
  const { block, offset } = parts;
  let i = 0;

  while (i < block.length) {
    const raw = block[i] as string;
    const lineNo = i + offset;

    if (raw.trim() === '') {
      i++;
      continue;
    }
    if (raw.startsWith('#')) {
      throw new FrontmatterError('comments are not supported in this frontmatter subset', file, lineNo);
    }
    if (INDENTED.test(raw)) {
      throw new FrontmatterError('unexpected indented line (no key opened above it)', file, lineNo);
    }

    const match = KEY.exec(raw);
    if (!match) {
      throw new FrontmatterError(
        `expected "key: value", "key: |" or "key:" followed by "- item" lines, got ${JSON.stringify(raw)}`,
        file,
        lineNo,
      );
    }
    const key = match[1] as string;
    const rest = (match[2] as string).trim();

    if (key in data) {
      throw new FrontmatterError(`duplicate key "${key}"`, file, lineNo);
    }

    // Form 2: block scalar.
    if (rest === '|') {
      const collected: string[] = [];
      i++;
      while (i < block.length && (block[i]?.trim() === '' || INDENTED.test(block[i] as string))) {
        collected.push((block[i] as string).replace(/^\s{1,2}/, ''));
        i++;
      }
      if (collected.length === 0) {
        throw new FrontmatterError(`block scalar "${key}: |" has no indented content`, file, lineNo);
      }
      data[key] = collected.join('\n').trim();
      continue;
    }

    // Form 3: list.
    if (rest === '') {
      const items: string[] = [];
      i++;
      while (i < block.length) {
        const candidate = block[i] as string;
        if (candidate.trim() === '') {
          i++;
          continue;
        }
        const item = LIST_ITEM.exec(candidate);
        if (!item) break;
        items.push((item[1] as string).trim());
        i++;
      }
      if (items.length === 0) {
        throw new FrontmatterError(`key "${key}" has no value and no "- item" lines beneath it`, file, lineNo);
      }
      data[key] = items;
      continue;
    }

    // Form 1: scalar. Taken literally — never coerced to number, boolean or date.
    if (rest.startsWith('[') || rest.startsWith('{') || rest.startsWith('&') || rest.startsWith('*') || rest.startsWith('!!')) {
      throw new FrontmatterError(
        'inline arrays, inline maps, anchors, aliases and tags are not supported in this frontmatter subset',
        file,
        lineNo,
      );
    }
    data[key] = rest;
    i++;
  }

  return { data, body: parts.body };
}
