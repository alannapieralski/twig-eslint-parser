import { parseForESLint } from '../../src/index.js';
import { createOffsetLocator } from '../../src/source-text.js';
import { groupTwigBlocks, type TwigBlock } from '../../src/twig/blocks.js';
import { toSameLengthJavaScript } from '../../src/twig/javascript.js';
import { tokenizeTwig } from '../../src/twig/tokens.js';

export type OutputIssue = { readonly check: string; readonly detail: string };

type Node = {
  readonly type: string;
  readonly range: [number, number];
  readonly loc: { start: { line: number; column: number }; end: { line: number; column: number } };
  readonly [key: string]: unknown;
};
type Token = { readonly value: string; readonly range: [number, number] };
type Range = readonly [number, number];

const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function walk(value: unknown, visit: (node: Node, parent: Node | undefined) => void, parent?: Node, seen = new Set<object>()): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((child) => walk(child, visit, parent, seen));
    return;
  }
  const node = isNode(value) ? value : undefined;
  if (node) visit(node, parent);
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'parent' && key !== 'loc' && key !== 'range') walk(child, visit, node ?? parent, seen);
  }
}

function overlaps([start, end]: Range, ranges: readonly Range[]): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && rangeStart < end);
}

function countClassAttributesInMarkup(code: string, blocks: readonly TwigBlock[]): number {
  let masked = code;
  for (const block of blocks) {
    const startsTagName = /<\/?[\w:-]*$/.test(code.slice(Math.max(0, block.start - 40), block.start));
    masked = masked.slice(0, block.start) + (startsTagName ? 'x' : ' ').repeat(block.end - block.start) + masked.slice(block.end);
  }
  masked = masked
    .replace(/<!--[\s\S]*?-->/g, (comment) => ' '.repeat(comment.length))
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (element) => element.replace(/>[\s\S]*</, (inner) => ' '.repeat(inner.length)));
  let count = 0;
  for (const [, , head = ''] of masked.matchAll(/<([A-Za-z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) count += (head.match(/(?:^|\s)class\s*=/gi) ?? []).length;
  return count;
}

export function checkParserOutput(code: string): OutputIssue[] {
  const issues: OutputIssue[] = [];
  const report = (check: string, detail: string) => issues.push({ check, detail });

  let result: ReturnType<typeof parseForESLint>;
  try {
    result = parseForESLint(code, { ignoreInterpolatedAttributes: ['class'] });
  } catch (error) {
    return [{ check: 'parses', detail: error instanceof Error ? error.message.split('\n')[0] ?? '' : String(error) }];
  }

  const locate = createOffsetLocator(code);
  const hasSameLoc = (node: Node) => {
    const start = locate(node.range[0]);
    const end = locate(node.range[1]);
    return node.loc.start.line === start.line && node.loc.start.column === start.column && node.loc.end.line === end.line && node.loc.end.column === end.column;
  };
  const isRangeInSource = (node: Node) => Array.isArray(node.range) && node.range[0] >= 0 && node.range[1] <= code.length && node.range[0] <= node.range[1];

  const allBlocks = groupTwigBlocks(tokenizeTwig(code));
  const expressionBlocks = allBlocks.filter((block) => block.kind !== 'comment');
  const services = result.services.twig;
  for (const block of services.unconvertedBlocks) report('converts every Twig block', `${code.slice(...block.range)} (${block.reason})`);
  const convertedRanges: Range[] = expressionBlocks
    .filter((block) => toSameLengthJavaScript(block) !== undefined && !services.unconvertedBlocks.some((unconverted) => unconverted.range[0] === block.start))
    .map((block) => [block.start, block.end]);

  const stringCountByStart = new Map<number, number>();
  walk(result.ast.twigBody, (node, parent) => {
    if (!isRangeInSource(node)) return report('twig: range inside the source', `${node.type} ${JSON.stringify(node.range)}`);
    const source = code.slice(...node.range);
    if (!hasSameLoc(node)) report('twig: loc matches range', `${node.type} "${source.slice(0, 40)}"`);
    if (parent && (node.range[0] < parent.range[0] || node.range[1] > parent.range[1])) report('twig: child inside parent', `${node.type} "${source.slice(0, 40)}" in ${parent.type}`);
    if (!parent && !convertedRanges.some(([start, end]) => node.range[0] >= start && node.range[1] <= end)) report('twig: statement inside its block', `${node.type} "${source.slice(0, 40)}"`);
    if (node.type === 'Identifier' && source !== node['name']) {
      const name = String(node['name']);
      const isRenamedReservedWord = name.length === source.length && name.startsWith('_') && source.slice(1).replace(/[^A-Za-z0-9_]/g, '_') === name.slice(1);
      if (!isRenamedReservedWord) report('twig: identifier matches source', `"${name}" vs "${source}"`);
    }
    if (node.type === 'Literal' && source !== node['raw']) report('twig: literal matches source', `${JSON.stringify(node['raw'])} vs ${JSON.stringify(source)}`);
    const isString = node.type === 'TemplateLiteral' || (node.type === 'Literal' && typeof node['value'] === 'string');
    if (isString) stringCountByStart.set(node.range[0], (stringCountByStart.get(node.range[0]) ?? 0) + 1);
    if (node.type === 'TemplateLiteral' && (!/^['"]/.test(source) || source.at(-1) !== source[0])) report('twig: string range on its Twig quotes', source.slice(0, 60));
    if (node.type === 'TemplateElement') {
      const inner = code.slice(node.range[0] + 1, node.range[1] - (node['tail'] ? 1 : 2));
      const raw = (node['value'] as { raw: string }).raw;
      if (inner !== raw) report('twig: string text matches source', `${JSON.stringify(raw).slice(0, 50)} vs ${JSON.stringify(inner).slice(0, 50)}`);
    }
  });
  for (const block of expressionBlocks) {
    if (!convertedRanges.some(([start]) => start === block.start)) continue;
    for (const token of block.tokens) {
      if (token.type !== 'OPENING_QUOTE') continue;
      const count = stringCountByStart.get(token.start) ?? 0;
      if (count !== 1) report('twig: every string appears once', `${count} times: ${code.slice(token.start, token.start + 50).split('\n')[0]}`);
    }
  }

  const commentRanges: Range[] = allBlocks.filter((block) => block.kind === 'comment').map((block) => [block.start, block.end]);
  let classAttributes = services.omittedAttributes.filter((attribute) => attribute.name.toLowerCase() === 'class').length;
  walk(result.ast.body, (node) => {
    if (!isRangeInSource(node)) return report('html: range inside the source', `${node.type} ${JSON.stringify(node.range)}`);
    const source = code.slice(...node.range);
    if (!hasSameLoc(node)) report('html: loc matches range', `${node.type} "${source.slice(0, 40)}"`);
    const value = node['value'];
    if (typeof value === 'string' && value.length === source.length && value !== source && !overlaps(node.range, commentRanges)) {
      report('html: node text matches source', `${node.type} ${JSON.stringify(source).slice(0, 50)} read as ${JSON.stringify(value).slice(0, 50)}`);
    }
    if (node.type !== 'Tag') return;
    const openStart = node['openStart'] as Token;
    const name = String(node['name']);
    for (const part of ['openStart', 'openEnd', 'close'] as const) {
      const token = node[part] as Token | undefined;
      if (token && code.slice(...token.range) !== token.value) report('html: tag parts match source', `${part} ${JSON.stringify(token.value).slice(0, 40)}`);
    }
    if (name.toLowerCase() !== code.slice(openStart.range[0] + 1, openStart.range[1]).toLowerCase()) report('html: tag name matches source', `${name} vs ${code.slice(...openStart.range)}`);
    if (!node['close'] && !node['selfClosing'] && !voidElements.has(name.toLowerCase())) report('html: element closes', `line ${node.loc.start.line}: ${code.slice(...openStart.range).slice(0, 60)}`);
    for (const attribute of node['attributes'] as { key: Token; value?: Token }[]) {
      if (code.slice(...attribute.key.range) !== attribute.key.value) report('html: attribute name matches source', JSON.stringify(attribute.key.value).slice(0, 40));
      if (attribute.key.value.toLowerCase() === 'class') classAttributes += 1;
    }
  });
  const expectedClassAttributes = countClassAttributesInMarkup(code, allBlocks);
  if (classAttributes !== expectedClassAttributes) report('html: every class attribute is read', `found ${classAttributes}, markup has ${expectedClassAttributes}`);

  return issues;
}
