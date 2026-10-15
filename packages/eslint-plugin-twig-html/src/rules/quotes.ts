import type { AST, Rule } from 'eslint';
import { readTwigServices, type TwigQuote, type TwigStringSummary } from 'twig-eslint-parser';
import { isOpenTagSwallowingMarkup, type TagNode as LayoutTagNode } from '../tag-layout.js';
import { depthChangeWithin } from '../twig-blocks.js';

type Range = readonly [number, number];
type QuoteStyle = 'single' | 'double';
type Options = { html?: QuoteStyle; twig?: QuoteStyle };
type Wrapper = { readonly value: string; readonly range: Range };
type AttributeValue = { readonly value: string; readonly range: Range; readonly parts: readonly { readonly type: string; readonly value: string }[] };
type AttributeNode = { readonly range: Range; readonly value?: AttributeValue; readonly startWrapper?: Wrapper; readonly endWrapper?: Wrapper };
type TagNode = { readonly openEnd?: Wrapper; readonly attributes: readonly AttributeNode[] };
type Fix = Rule.ReportFixer | undefined;

const quoteByStyle: Record<QuoteStyle, TwigQuote> = { single: "'", double: '"' };

function describeQuote(quote: TwigQuote): string {
  return quote === "'" ? "single (')" : 'double (")';
}

// Returns the value's HTML text without its Twig blocks.
function htmlTextOf(value: AttributeValue | undefined): string {
  if (!value) return '';
  if (value.parts.length === 0) return value.value;
  return value.parts.filter((part) => part.type === 'Part').map((part) => part.value).join('');
}

function printsUnescapedTwig(value: AttributeValue | undefined): boolean {
  return value?.parts.some((part) => part.type === 'Template' && /\|\s*raw\b/.test(part.value)) ?? false;
}

function isPlainTextOrOnePrint(value: AttributeValue): boolean {
  const [onlyPart, ...otherParts] = value.parts;
  if (!onlyPart) return true;
  return otherParts.length === 0 && onlyPart.type === 'Template' && onlyPart.value.startsWith('{{');
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

      const isSafeToSwap = isFixable && !printsUnescapedTwig(attribute.value);
      const fix: Fix = isSafeToSwap ? (fixer) => [fixer.replaceTextRange([...startWrapper.range], htmlQuote), fixer.replaceTextRange([...endWrapper.range], htmlQuote)] : undefined;
      report(attribute.range, 'wrongHtmlQuote', htmlQuote, fix);
    };

    const isSafeToWrap = (value: AttributeValue, isFixable: boolean) => isFixable
      && isPlainTextOrOnePrint(value)
      && !/["'=<>`]/.test(htmlTextOf(value))
      && /^(\s|>|$)/.test(sourceCode.text.charAt(value.range[1]));

    const checkUnquotedAttribute = (attribute: AttributeNode, value: AttributeValue, isFixable: boolean) => {
      const fix: Fix = isSafeToWrap(value, isFixable) ? (fixer) => [fixer.insertTextBeforeRange([...value.range], htmlQuote), fixer.insertTextAfterRange([...value.range], htmlQuote)] : undefined;
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

    const checkTag = (node: TagNode) => {
      const isInSoundTag = node.openEnd !== undefined && !isOpenTagSwallowingMarkup(node as unknown as LayoutTagNode, sourceCode.text);
      for (const attribute of node.attributes) checkAttribute(attribute, isInSoundTag);
    };

    return {
      Program() {
        for (const omitted of omittedAttributes) checkAttribute(omitted.attribute as unknown as AttributeNode, true);
        for (const string of strings) checkTwigString(string);
      },
      Tag: checkTag,
      ScriptTag: checkTag,
      StyleTag: checkTag,
    } as unknown as Rule.RuleListener;
  },
};
