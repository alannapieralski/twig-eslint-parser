import { isDrupalAttributeListPrint } from '../drupal.js';
import type { TemplateWrapper } from '../es-html-parser/types/index.js';
import type { TwigBlock } from '../twig/blocks.js';
import { classifyPrintsInTagNames, type TagNamePrintRole } from './tag-name-roles.js';

function delimiterEnd(block: TwigBlock): number {
  const closing = block.tokens.at(-1);
  const lineBreak = /\r?\n$/.exec(closing?.value ?? '')?.[0] ?? '';
  return block.end - lineBreak.length;
}

function templateInfoOf(source: string, block: TwigBlock, tagNamePrintRoles: ReadonlyMap<TwigBlock, TagNamePrintRole>): TemplateWrapper {
  const end = delimiterEnd(block);
  const tagNameRole = tagNamePrintRoles.get(block);
  const isAttributesPrint = block.kind === 'print' && (tagNameRole ? tagNameRole === 'starts-attributes' : isDrupalAttributeListPrint(source.slice(block.start, end)));
  return { open: [block.start, block.start + 2], close: [end - 2, end], kind: block.kind, ...(isAttributesPrint && { role: 'attributes' as const }) };
}

export function templateInfosOf(source: string, blocks: readonly TwigBlock[]): TemplateWrapper[] {
  const tagNamePrintRoles = classifyPrintsInTagNames(source, blocks);
  return blocks.map((block) => templateInfoOf(source, block, tagNamePrintRoles));
}
