import type { Rule } from 'eslint';
import { readTwigServices } from 'twig-eslint-parser';
import { docsUrlFor } from '../../shared/docs-url.js';
import { reportProblems } from '../../shared/report-problems.js';
import { findUnparsedTwigProblems } from './find-unparsed-twig-problems.js';
import { messages } from './messages.js';

export const noUnparsedTwig: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Report Twig blocks the parser could not read, so the classes inside them are not skipped silently',
      url: docsUrlFor('no-unparsed-twig'),
    },
    schema: [],
    messages,
  },

  create(context) {
    const { unconvertedBlocks } = readTwigServices(context.sourceCode, context.id);

    return { Program: () => reportProblems(context, findUnparsedTwigProblems(unconvertedBlocks)) };
  },
};
