import type { Rule } from 'eslint';
import { readTwigServices } from 'twig-eslint-parser';
import { docsUrlFor } from '../../shared/docs-url.js';
import { reportProblems } from '../../shared/report-problems.js';
import { tagListeners } from '../../shared/tag-listeners.js';
import { tagNodeTypes } from '../../shared/tag-node.js';
import { findProgramProblems } from './find-program-problems.js';
import { findTagProblems } from './find-tag-problems.js';
import { groupOmittedAttributes } from './group-omitted-attributes.js';
import { messages } from './messages.js';
import { optionsSchema, resolveOptions } from './options.js';
import { quotesFor } from './quote-style.js';
import type { TagWithAttributes } from './types.js';

export const quotes: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce one quote style for HTML attribute values and another for Twig strings',
      url: docsUrlFor('quotes'),
    },
    fixable: 'code',
    schema: [optionsSchema],
    messages,
  },

  create(context) {
    const options = resolveOptions(context.options[0]);
    const { sourceCode } = context;
    const { blocks, strings, omittedAttributes } = readTwigServices(sourceCode, context.id);
    const source = { text: sourceCode.text, blocks, ...quotesFor(options) };
    const { unowned, ownedByTag } = groupOmittedAttributes(omittedAttributes, (index) => sourceCode.getNodeByRangeIndex(index));

    const checkTag = (tag: TagWithAttributes) => reportProblems(context, findTagProblems(tag, ownedByTag, source));

    return {
      Program: () => reportProblems(context, findProgramProblems(unowned, strings, source)),
      ...tagListeners(checkTag, tagNodeTypes),
    };
  },
};
