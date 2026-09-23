import type { Rule } from 'eslint';
import type { TwigParserServices } from '../parse-for-eslint.js';

type AttributeNode = {
  readonly type: 'Attribute';
  readonly range: [number, number];
  readonly key: { readonly value: string };
  readonly value?: { readonly parts?: readonly { readonly type: string }[] };
};

type NodeWithAttributes = { readonly attributes?: readonly unknown[] };

const defaultAttributeNames = ['class'];

function isAttributeNode(value: unknown): value is AttributeNode {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'Attribute';
}

function containsTwig(attribute: AttributeNode): boolean {
  return attribute.value?.parts?.some((part) => part.type === 'Template') ?? false;
}

function readTwigServices(context: Rule.RuleContext): TwigParserServices {
  const services = context.sourceCode.parserServices as { twig?: TwigParserServices } | undefined;
  if (!services?.twig) {
    throw new Error('twig-eslint-parser/no-interpolated-attributes needs twig-eslint-parser as the parser for this file.');
  }
  return services.twig;
}

export const noInterpolatedAttributes: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow Twig inside attribute values such as class="", so every class stays visible to linting',
    },
    schema: [{
      type: 'object',
      properties: { attributes: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true } },
      additionalProperties: false,
    }],
    messages: {
      twigInAttribute: 'Avoid Twig inside {{name}}="": linters cannot see what it produces. Build the value with {% set classes = [...] %} and attributes.addClass(), or pass it to an include as { classes: [...] }.',
    },
  },

  create(context) {
    const options = (context.options[0] ?? {}) as { attributes?: string[] };
    const attributeNames = new Set((options.attributes ?? defaultAttributeNames).map((name) => name.toLowerCase()));
    const isRestricted = (name: string) => attributeNames.has(name.toLowerCase());
    const report = (name: string, range: readonly [number, number]) => context.report({
      loc: { start: context.sourceCode.getLocFromIndex(range[0]), end: context.sourceCode.getLocFromIndex(range[1]) },
      messageId: 'twigInAttribute',
      data: { name },
    });
    const checkAttributes = (node: Rule.Node) => {
      const attributes = (node as unknown as NodeWithAttributes).attributes ?? [];
      for (const attribute of attributes.filter(isAttributeNode)) {
        if (isRestricted(attribute.key.value) && containsTwig(attribute)) report(attribute.key.value, attribute.range);
      }
    };

    return {
      Program() {
        for (const attribute of readTwigServices(context).omittedAttributes) {
          if (isRestricted(attribute.name)) report(attribute.name, attribute.range);
        }
      },
      Tag: checkAttributes,
      ScriptTag: checkAttributes,
      StyleTag: checkAttributes,
    } as Rule.RuleListener;
  },
};
