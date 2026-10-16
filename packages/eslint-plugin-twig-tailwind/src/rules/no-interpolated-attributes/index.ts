import type { Rule } from 'eslint';
import { readTwigServices } from 'twig-eslint-parser';
import { docsUrlFor } from '../../shared/docs-url.js';
import { reportProblems } from '../../shared/report-problems.js';
import { tagNodeTypes } from '../../shared/tag-node.js';
import { findInterpolatedAttributeProblems, findOmittedAttributeProblems } from './find-interpolated-attribute-problems.js';
import { messages } from './messages.js';
import { optionsSchema, resolveOptions } from './options.js';
import type { TagWithAttributes } from './types.js';

export const noInterpolatedAttributes: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow Twig inside attribute values such as class="", so every class stays visible to linting',
      url: docsUrlFor('no-interpolated-attributes'),
    },
    schema: [optionsSchema],
    messages,
  },

  create(context) {
    const options = resolveOptions(context.options[0]);
    const { omittedAttributes } = readTwigServices(context.sourceCode, context.id);

    const checkTag = (tag: TagWithAttributes) => reportProblems(context, findInterpolatedAttributeProblems(tag, options));
    const tagListeners = Object.fromEntries(tagNodeTypes.map((nodeType) => [nodeType, checkTag]));

    return {
      Program: () => reportProblems(context, findOmittedAttributeProblems(omittedAttributes, options)),
      ...tagListeners,
    } as Rule.RuleListener;
  },
};
