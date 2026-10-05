import type { Rule } from 'eslint';
import { readTwigServices } from './twig-services.js';

export const noUnparsedTwig: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report Twig blocks the parser could not read, so the classes inside them are not skipped silently',
      url: 'https://github.com/alannapieralski/twig-eslint-parser/blob/main/packages/eslint-plugin-twig-tailwind/docs/rules/no-unparsed-twig.md',
    },
    schema: [],
    messages: {
      unparsedTwig: 'This Twig block could not be parsed ({{reason}}), so nothing inside it is linted. Check the expression is valid Twig.',
    },
  },

  create(context) {
    return {
      Program() {
        for (const block of readTwigServices(context).unconvertedBlocks) {
          context.report({
            loc: { start: context.sourceCode.getLocFromIndex(block.range[0]), end: context.sourceCode.getLocFromIndex(block.range[1]) },
            messageId: 'unparsedTwig',
            data: { reason: block.reason },
          });
        }
      },
    };
  },
};
