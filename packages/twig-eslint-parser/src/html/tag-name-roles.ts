import type { TwigBlock } from '../twig/blocks.js';

export type TagNamePrintRole = 'starts-attributes' | 'continues-name';

type NamePart = { readonly spelling: string; readonly print: TwigBlock | undefined };

const tagOpening = /<(\/?)(?=[\w{])/g;
const nameCharacter = /[\w:.-]/;
const whitespace = /\s+/g;

function readNameParts(source: string, start: number, printsByStart: ReadonlyMap<number, TwigBlock>): NamePart[] {
  const parts: NamePart[] = [];
  let position = start;
  while (position < source.length) {
    const print = printsByStart.get(position);
    if (print) {
      parts.push({ spelling: source.slice(print.start, print.end).replace(whitespace, ''), print });
      position = print.end;
      continue;
    }
    const character = source.charAt(position);
    if (!nameCharacter.test(character)) break;
    const previous = parts.at(-1);
    if (previous && !previous.print) parts[parts.length - 1] = { spelling: previous.spelling + character.toLowerCase(), print: undefined };
    else parts.push({ spelling: character.toLowerCase(), print: undefined });
    position += 1;
  }
  return parts;
}

function spellingOf(parts: readonly NamePart[], count: number): string {
  return parts.slice(0, count).map((part) => part.spelling).join('');
}

function countPartsSpelledByCloseTag(parts: readonly NamePart[], closeTagSpellings: ReadonlySet<string>): number {
  for (let count = parts.length; count > 1; count -= 1) {
    if (closeTagSpellings.has(spellingOf(parts, count))) return count;
  }
  return 1;
}

// Tells, for each print after the first part of a tag name, whether it starts the attributes (<div{{ attr }}>) or continues the name because a close tag spells it (<h{{ level }}>...</h{{ level }}>).
export function classifyPrintsInTagNames(source: string, blocks: readonly TwigBlock[]): ReadonlyMap<TwigBlock, TagNamePrintRole> {
  const printsByStart = new Map(blocks.filter((block) => block.kind === 'print').map((block) => [block.start, block] as const));
  const closeTagSpellings = new Set<string>();
  const openTagParts: NamePart[][] = [];
  let blockIndex = 0;

  for (const match of source.matchAll(tagOpening)) {
    let block = blocks[blockIndex];
    while (block && block.end <= match.index) block = blocks[++blockIndex];
    if (block && block.start <= match.index) continue;
    const parts = readNameParts(source, match.index + match[0].length, printsByStart);
    if (!parts.some((part) => part.print)) continue;
    if (match[1] === '/') closeTagSpellings.add(spellingOf(parts, parts.length));
    else openTagParts.push(parts);
  }

  const roles = new Map<TwigBlock, TagNamePrintRole>();
  for (const parts of openTagParts) {
    const nameLength = countPartsSpelledByCloseTag(parts, closeTagSpellings);
    parts.forEach((part, index) => {
      if (part.print && index > 0) roles.set(part.print, index < nameLength ? 'continues-name' : 'starts-attributes');
    });
  }
  return roles;
}
