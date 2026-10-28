import { ELEMENT_NODE_TYPES, readTwigServices } from 'twig-eslint-parser';
import { docsUrlFor } from '../../shared/docs-url.js';
import { reportProblems } from '../../shared/report-problems.js';
import { createInterpolationReport } from './interpolation-report.js';
import { messages } from './messages.js';
import { optionsSchema, resolveOptions } from './options.js';
import type { Rule } from 'eslint';

export const noTwigInterpolation: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow Twig interpolation in attributes and strings',
      url: docsUrlFor('no-twig-interpolation'),
    },
    schema: [optionsSchema],
    messages,
  },

  create(context) {
    const options = resolveOptions(context.options[0]);
    const report = createInterpolationReport(readTwigServices(context.sourceCode, context.id), options);
    const addTagByNodeType = Object.fromEntries(ELEMENT_NODE_TYPES.map((nodeType) => [nodeType, report.addTag]));

    return {
      ...addTagByNodeType,
      'Program:exit': () => reportProblems(context, report.findProblems()),
    } as Rule.RuleListener;
  },
};
