import type { AttributeNode } from '../../attributes.js';
import type { TwigDiagnostic } from '../../diagnostics.js';
import type { Range } from '../../range.js';
import type { TwigBlockSummary } from '../../twig/blocks.js';
import type { MarkupElement } from './markup-elements.js';

type StrayCharacterDiagnostic = Pick<TwigDiagnostic, 'code' | 'message'>;

const QUOTED_VALUE = /"[^"]*"|'[^']*'/g;
const CHARACTER_THAT_BREAKS_AN_ATTRIBUTE = /["'<]/;

const OPEN_TAG_ENDINGS: ReadonlySet<string> = new Set(['>', '/>']);

export const UNTERMINATED_TAG_MESSAGE = 'This tag never ends with ">", so the markup after it is read as part of the tag. Add the ">".';

const STRAY_SOLIDUS_MESSAGE = 'A "/" in this tag is not followed by ">". Browsers ignore it, but the attributes after it are not read. Remove the "/".';

const STRAY_CHARACTER_IN_NAME: StrayCharacterDiagnostic = {
  code: 'unexpected-character-in-attribute-name',
  message: 'An attribute name contains a quote or "<", so an attribute value was probably quoted wrongly. Check the quotes before it.',
};

const STRAY_CHARACTER_IN_VALUE: StrayCharacterDiagnostic = {
  code: 'unexpected-character-in-unquoted-attribute-value',
  message: 'An unquoted attribute value contains a quote or "<", so the tag takes in the markup after it. Quote the value or close the tag.',
};

function textWithoutTwig(text: string, range: Range, blocks: readonly TwigBlockSummary[]): string {
  const blocksWithin = blocks.filter((block) => block.range[0] >= range[0] && block.range[1] <= range[1]);
  let remaining = '';
  let position = range[0];

  for (const block of blocksWithin) {
    remaining += text.slice(position, block.range[0]);
    position = block.range[1];
  }

  return remaining + text.slice(position, range[1]);
}

function describeStrayCharacter(attribute: AttributeNode, text: string, blocks: readonly TwigBlockSummary[]): StrayCharacterDiagnostic | undefined {
  const withoutQuotedValues = textWithoutTwig(text, attribute.range, blocks).replace(QUOTED_VALUE, '');
  if (!CHARACTER_THAT_BREAKS_AN_ATTRIBUTE.test(withoutQuotedValues)) return undefined;

  const [name = ''] = withoutQuotedValues.split('=');
  return CHARACTER_THAT_BREAKS_AN_ATTRIBUTE.test(name) ? STRAY_CHARACTER_IN_NAME : STRAY_CHARACTER_IN_VALUE;
}

function findUnterminatedOpenTag(element: MarkupElement): TwigDiagnostic {
  const attributeEnds = element.attributes.map((attribute) => attribute.range[1]);
  const end = Math.max(element.openStart.range[1], ...attributeEnds);

  return {
    code: 'eof-in-tag',
    message: UNTERMINATED_TAG_MESSAGE,
    range: [element.openStart.range[0], end],
  };
}

function findOpenTagDiagnostic(element: MarkupElement, text: string, blocks: readonly TwigBlockSummary[]): TwigDiagnostic | undefined {
  if (!element.openEnd) return findUnterminatedOpenTag(element);

  const openTagRange: Range = [element.openStart.range[0], element.openEnd.range[1]];
  const hasStraySolidus = !OPEN_TAG_ENDINGS.has(element.openEnd.value);
  if (hasStraySolidus) return { code: 'unexpected-solidus-in-tag', message: STRAY_SOLIDUS_MESSAGE, range: openTagRange };

  const strayCharacter = element.attributes.map((attribute) => describeStrayCharacter(attribute, text, blocks)).find((description) => description !== undefined);
  if (!strayCharacter) return undefined;

  return { ...strayCharacter, range: openTagRange };
}

export function findOpenTagDiagnostics(elements: readonly MarkupElement[], text: string, blocks: readonly TwigBlockSummary[]): TwigDiagnostic[] {
  return elements.map((element) => findOpenTagDiagnostic(element, text, blocks)).filter((diagnostic) => diagnostic !== undefined);
}
