import { delimiterEndOf } from '../twig/blocks.js';
import type { TemplateWrapper } from '../es-html-parser/types/index.js';
import type { TwigBlock } from '../twig/blocks.js';

function templateInfoOf(block: TwigBlock): TemplateWrapper {
  const end = delimiterEndOf(block);
  return { open: [block.start, block.start + 2], close: [end - 2, end], kind: block.kind };
}

export function templateInfosOf(blocks: readonly TwigBlock[]): TemplateWrapper[] {
  return blocks.map(templateInfoOf);
}
