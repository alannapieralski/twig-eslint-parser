import type { AST, Rule } from 'eslint';
import { containsTwig, readTwigServices, type AttributeNode, type OmittedAttribute, type TwigQuote, type TwigStringSummary } from 'twig-eslint-parser';
import { isOpenTagSwallowingMarkup, type Range } from '../tag-layout.js';
import { depthChangeWithin } from '../twig-blocks.js';

type QuoteStyle = 'single' | 'double';
type Options = { html?: QuoteStyle; twig?: QuoteStyle };
type Wrapper = NonNullable<AttributeNode['startWrapper']>;
type AttributeValue = NonNullable<AttributeNode['value']>;
type TagNode = { readonly openEnd?: Wrapper; readonly attributes: readonly AttributeNode[] };
type Fix = Rule.ReportFixer | undefined;

const tagTypes: ReadonlySet<string> = new Set(['Tag', 'ScriptTag', 'StyleTag']);
const quoteByStyle: Record<QuoteStyle, TwigQuote> = { single: "'", double: '"' };
const twigThatPrintsNothing = /^(?:\{#|\{%[-~]?\s*(?:if|elseif|else|endif|for|endfor)\b)/;

function describeQuote(quote: TwigQuote): string {
  return quote === "'" ? "single (')" : 'double (")';
}

// Returns the value's HTML text without its Twig blocks.
function htmlTextOf(value: AttributeValue | undefined): string {
  if (!value) return '';
  if (!value.parts?.length) return value.value;
  return value.parts.filter((part) => part.type === 'Part').map((part) => part.value).join('');
}

function printsTwigOutput(value: AttributeValue | undefined): boolean {
  return value?.parts?.some((part) => part.type === 'Template' && !twigThatPrintsNothing.test(part.value)) ?? false;
}

// Rewrites a Twig string body for another quote, or returns undefined when it cannot be rewritten as it is.
function requote(body: string, from: TwigQuote, to: TwigQuote): string | undefined {
  let requoted = '';
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index] as string;
    if (character === '\\') {
      const escaped = body[index + 1] ?? '';
      requoted += escaped === from ? from : `\\${escaped}`;
      index += 1;
      continue;
    }
    if (character === to) return undefined;
    if (to === '"' && character === '#' && body[index + 1] === '{') return undefined;
    requoted += character;
  }
  return requoted;
}

export const quotes: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce one quote style for HTML attribute values and another for Twig strings',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-html/docs/rules/quotes.md',
    },
    fixable: 'code',
    schema: [{
      type: 'object',
      properties: {
        html: { enum: ['single', 'double'] },
        twig: { enum: ['single', 'double'] },
      },
      additionalProperties: false,
    }],
    messages: {
      wrongHtmlQuote: 'Expected {{expected}} quotes around this attribute value.',
      missingHtmlQuote: 'Wrap this attribute value in {{expected}} quotes.',
      wrongTwigQuote: 'Expected {{expected}} quotes around this Twig string.',
    },
  },

  create(context) {
    const options: Required<Options> = { html: 'double', twig: 'single', ...(context.options[0] as Options | undefined) };
    const htmlQuote = quoteByStyle[options.html];
    const twigQuote = quoteByStyle[options.twig];
    const { sourceCode } = context;
    const { blocks, strings, omittedAttributes } = readTwigServices(sourceCode, context.id);

    const locOf = (range: Range): AST.SourceLocation => ({ start: sourceCode.getLocFromIndex(range[0]), end: sourceCode.getLocFromIndex(range[1]) });
    const report = (range: Range, messageId: string, quote: TwigQuote, fix: Fix) => context.report({ loc: locOf(range), messageId, data: { expected: describeQuote(quote) }, ...(fix && { fix }) });

    const checkWrappedAttribute = (attribute: AttributeNode, startWrapper: Wrapper, endWrapper: Wrapper, isFixable: boolean) => {
      if (startWrapper.value !== endWrapper.value || startWrapper.value === htmlQuote) return;
      if (htmlTextOf(attribute.value).includes(htmlQuote)) return;

      const isSafeToSwap = isFixable && !printsTwigOutput(attribute.value);
      const fix: Fix = isSafeToSwap ? (fixer) => [fixer.replaceTextRange([...startWrapper.range], htmlQuote), fixer.replaceTextRange([...endWrapper.range], htmlQuote)] : undefined;
      report(attribute.range, 'wrongHtmlQuote', htmlQuote, fix);
    };

    const isSafeToWrap = (attribute: AttributeNode, value: AttributeValue, isFixable: boolean) => isFixable
      && !containsTwig(attribute)
      && !/["'=<>`]/.test(htmlTextOf(value))
      && /^(\s|>|$)/.test(sourceCode.text.charAt(value.range[1]));

    const checkUnquotedAttribute = (attribute: AttributeNode, value: AttributeValue, isFixable: boolean) => {
      const fix: Fix = isSafeToWrap(attribute, value, isFixable) ? (fixer) => [fixer.insertTextBeforeRange([...value.range], htmlQuote), fixer.insertTextAfterRange([...value.range], htmlQuote)] : undefined;
      report(attribute.range, 'missingHtmlQuote', htmlQuote, fix);
    };

    const checkAttribute = (attribute: AttributeNode, isInSoundTag: boolean) => {
      const { value, startWrapper, endWrapper } = attribute;
      const isFixable = isInSoundTag && (value === undefined || depthChangeWithin(value.range, blocks) === 0);
      if (startWrapper && endWrapper) return checkWrappedAttribute(attribute, startWrapper, endWrapper, isFixable);
      if (startWrapper || endWrapper || !value || value.value === '') return;
      checkUnquotedAttribute(attribute, value, isFixable);
    };

    const checkTwigString = (string: TwigStringSummary) => {
      if (string.quote === twigQuote) return;
      if (string.isInterpolated) return;

      const body = sourceCode.text.slice(string.range[0] + 1, string.range[1] - 1);
      const requoted = requote(body, string.quote, twigQuote);
      if (requoted === undefined) return;

      report(string.range, 'wrongTwigQuote', twigQuote, (fixer) => fixer.replaceTextRange([...string.range], `${twigQuote}${requoted}${twigQuote}`));
    };

    const omittedByTag = new Map<unknown, AttributeNode[]>();
    const collectOmittedAttribute = (omitted: OmittedAttribute) => {
      const owner = sourceCode.getNodeByRangeIndex(omitted.range[0]);
      const isOwnedByTag = owner !== null && tagTypes.has(owner.type);
      if (!isOwnedByTag) return checkAttribute(omitted.attribute, false);
      omittedByTag.set(owner, [...(omittedByTag.get(owner) ?? []), omitted.attribute]);
    };

    const checkTag = (node: TagNode) => {
      const attributes = [...node.attributes, ...(omittedByTag.get(node) ?? [])];
      const isInSoundTag = !isOpenTagSwallowingMarkup({ ...node, attributes }, sourceCode.text);
      for (const attribute of attributes) checkAttribute(attribute, isInSoundTag);
    };

    return {
      Program() {
        for (const omitted of omittedAttributes) collectOmittedAttribute(omitted);
        for (const string of strings) checkTwigString(string);
      },
      Tag: checkTag,
      ScriptTag: checkTag,
      StyleTag: checkTag,
    } as unknown as Rule.RuleListener;
  },
};
